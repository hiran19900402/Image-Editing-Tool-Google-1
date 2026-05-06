import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { removeBackground } from '@imgly/background-removal-node';

const PORT = 3000;
const UPLOADS_DIR = path.join(process.cwd(), 'temp_uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const storage = multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    }
  });

  const upload = multer({ storage });

  // --- API Routes ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Get metadata
  app.post('/api/metadata', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      const metadata = await sharp(req.file.path).metadata();
      
      // Cleanup
      fs.unlinkSync(req.file.path);
      
      res.json(metadata);
    } catch (error) {
      console.error('Metadata error:', error);
      res.status(500).json({ error: 'Failed to read metadata' });
    }
  });

  // Process image
  app.post('/api/process', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      const operations = JSON.parse(req.body.operations || '[]');
      const targetFormat = req.body.targetFormat || 'png';
      const quality = parseInt(req.body.quality || '80');
      
      let imageSource: string | Buffer = req.file.path;

      // Handle background removal first if requested, as it returns a new image
      const removeBgOp = operations.find((op: any) => op.type === 'remove-bg');
      if (removeBgOp) {
        const bgRemovedBlob = await removeBackground(imageSource);
        imageSource = Buffer.from(await bgRemovedBlob.arrayBuffer());
      }

      let pipeline = sharp(imageSource);

      for (const op of operations) {
        if (op.type === 'remove-bg') continue; // Already handled
        switch (op.type) {
          case 'adjust':
            // Combined adjustments for performance
            pipeline = pipeline.modulate({
              brightness: op.brightness ?? 1,
              saturation: op.saturation ?? 1,
              hue: op.hue ?? 0,
            });
            // Sharp linear for contrast: a*x + b
            // contrast > 1 increases contrast, 1 is no change
            if (op.contrast !== undefined && op.contrast !== 1) {
              pipeline = pipeline.linear(op.contrast, -(128 * op.contrast) + 128);
            }
            if (op.gamma !== undefined) {
              pipeline = pipeline.gamma(op.gamma);
            }
            if (op.grayscale) {
              pipeline = pipeline.grayscale();
            }
            if (op.blur !== undefined && op.blur > 0) {
              pipeline = pipeline.blur(op.blur);
            }
            break;
          case 'filter':
            // Predefined filter logic
            switch (op.name) {
              case 'vivid':
                pipeline = pipeline.modulate({ saturation: 1.5 }).linear(1.1, -12);
                break;
              case 'warm':
                pipeline = pipeline.modulate({ saturation: 1.2 }).tint('#ffcc33');
                break;
              case 'cool':
                pipeline = pipeline.modulate({ saturation: 1.1 }).tint('#33ccff');
                break;
              case 'vintage':
                pipeline = pipeline.modulate({ saturation: 0.8 }).recomb([
                  [0.3588, 0.7044, 0.1368],
                  [0.2990, 0.5870, 0.1140],
                  [0.2392, 0.4696, 0.0912]
                ]).linear(0.9, 10);
                break;
              case 'mono':
                pipeline = pipeline.grayscale().linear(1.2, -20);
                break;
              case 'soft':
                pipeline = pipeline.blur(2).modulate({ brightness: 1.1 });
                break;
              case 'color-pop':
                pipeline = pipeline.modulate({ saturation: 2.0 }).linear(1.1, -10);
                break;
              case 'duotone':
                pipeline = pipeline.grayscale().tint('#3366ff');
                break;
            }
            break;
          case 'resize':
            pipeline = pipeline.resize(op.width, op.height, {
              fit: op.fit || 'cover',
              withoutEnlargement: true
            });
            break;
          case 'rotate':
            pipeline = pipeline.rotate(op.angle || 0);
            break;
          case 'flip':
            pipeline = pipeline.flip();
            break;
          case 'flop':
            pipeline = pipeline.flop();
            break;
          case 'crop':
            pipeline = pipeline.extract({
              left: Math.round(op.left || 0),
              top: Math.round(op.top || 0),
              width: Math.round(op.width || 100),
              height: Math.round(op.height || 100)
            });
            break;
          case 'blur':
            pipeline = pipeline.blur(op.sigma || 5);
            break;
          case 'grayscale':
            pipeline = pipeline.grayscale();
            break;
          case 'negate':
            pipeline = pipeline.negate();
            break;
          case 'modulate':
            pipeline = pipeline.modulate({
              brightness: op.brightness || 1,
              saturation: op.saturation || 1,
              hue: op.hue || 0
            });
            break;
          case 'sharpen':
            pipeline = pipeline.sharpen();
            break;
          case 'tint':
            pipeline = pipeline.tint(op.color || '#ff0000');
            break;
          case 'threshold':
             pipeline = pipeline.threshold(op.value || 128);
             break;
          case 'gamma':
            pipeline = pipeline.gamma(op.value || 2.2);
            break;
          case 'median':
            pipeline = pipeline.median(op.size || 3);
            break;
          case 'text': {
            const textBuffer = await pipeline.toBuffer();
            const textMeta = await sharp(textBuffer).metadata();
            const w = textMeta.width || 800;
            const h = textMeta.height || 600;
            pipeline = sharp(textBuffer);

            const text = op.text || '';
            const color = op.color || '#ffffff';
            const size = op.fontSize || 48;
            const font = op.fontFamily || 'sans-serif';
            const isBold = op.bold ? 'font-weight: bold;' : '';
            const isItalic = op.italic ? 'font-style: italic;' : '';
            const x = op.x !== undefined ? `${op.x}%` : '50%';
            const y = op.y !== undefined ? `${op.y}%` : '50%';
            
            // Basic SVG sanitization
            const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            const svg = `
              <svg width="${w}" height="${h}">
                <style><![CDATA[
                  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700&family=Space+Grotesk:wght@700&family=Outfit:wght@700&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@700&family=Bebas+Neue&family=Montserrat:wght@700&family=Lobster&family=Dancing+Script:wght@700&display=swap');
                  .text { 
                    fill: ${color}; 
                    font-size: ${size}px; 
                    font-family: ${font}; 
                    ${isBold}
                    ${isItalic}
                  }
                ]]></style>
                <text 
                  x="${x}" 
                  y="${y}" 
                  class="text"
                  text-anchor="middle" 
                  dominant-baseline="middle"
                >${safeText}</text>
              </svg>
            `;
            pipeline = pipeline.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
            break;
          }
          case 'rounded':
            const roundBuffer = await pipeline.toBuffer();
            const roundMeta = await sharp(roundBuffer).metadata();
            const rw = roundMeta.width || 0;
            const rh = roundMeta.height || 0;
            pipeline = sharp(roundBuffer);

            const radius = Math.min(rw, rh) * (op.radius / 100);
            const mask = Buffer.from(
              `<svg><rect x="0" y="0" width="${rw}" height="${rh}" rx="${radius}" ry="${radius}" /></svg>`
            );
            pipeline = pipeline.composite([{
              input: mask,
              blend: 'dest-in'
            }]);
            break;
          case 'draw': {
            const { data: dBuf, info: dMeta } = await pipeline.png().toBuffer({ resolveWithObject: true });
            const dw = dMeta.width;
            const dh = dMeta.height;
            pipeline = sharp(dBuf);

            let drawSvg = '';
            const color = op.color || '#000000';
            const opacity = op.opacity || 1;
            const strokeWidth = (op.size / dw) * 100;

            if (op.mode === 'brush' || op.mode === 'eraser') {
              const blendMode = op.mode === 'eraser' ? 'dest-out' : 'over';
              drawSvg = `
                <svg width="${dw}" height="${dh}" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                  <path 
                    d="${op.path}" 
                    fill="none" 
                    stroke="${color}" 
                    stroke-width="${strokeWidth}" 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    opacity="${opacity}"
                  />
                </svg>
              `;
              pipeline = pipeline.composite([{
                input: Buffer.from(drawSvg),
                blend: blendMode
              }]);
            } else if (['line', 'rect', 'circle'].includes(op.mode)) {
              if (op.mode === 'line') {
                drawSvg = `<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}" stroke-linecap="round" />`;
              } else if (op.mode === 'rect') {
                const rx = Math.min(op.x1, op.x2);
                const ry = Math.min(op.y1, op.y2);
                const rw = Math.abs(op.x2 - op.x1);
                const rh = Math.abs(op.y2 - op.y1);
                drawSvg = `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}" />`;
              } else if (op.mode === 'circle') {
                const r = Math.sqrt(Math.pow(op.x2 - op.x1, 2) + Math.pow(op.y2 - op.y1, 2));
                drawSvg = `<circle cx="${op.x1}" cy="${op.y1}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}" />`;
              }

              const fullSvg = `<svg width="${dw}" height="${dh}" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${drawSvg}</svg>`;
              pipeline = pipeline.composite([{
                input: Buffer.from(fullSvg)
              }]);
            }
            break;
          }
          case 'erase':
            pipeline = pipeline.ensureAlpha();
            const { data: eBuf, info: eInfo } = await pipeline.png().toBuffer({ resolveWithObject: true });
            const ew = eInfo.width;
            const eh = eInfo.height;
            pipeline = sharp(eBuf);

            const strokeWidthPercent = (op.size / ew) * 100;
            const eraseSvg = `
              <svg width="${ew}" height="${eh}" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="${op.path}" 
                  fill="none" 
                  stroke="white" 
                  stroke-width="${strokeWidthPercent}" 
                  stroke-linecap="round" 
                  stroke-linejoin="round" 
                />
              </svg>
            `;

            pipeline = pipeline.composite([{
              input: Buffer.from(eraseSvg),
              blend: 'dest-out'
            }]);
            break;
          case 'overlay':
          case 'watermark':
            const { data: cBuf, info: cMeta } = await pipeline.png().toBuffer({ resolveWithObject: true });
            const cw = cMeta.width;
            const ch = cMeta.height;
            pipeline = sharp(cBuf);

            let overlayBuffer: Buffer | null = null;
            let targetW = Math.round((op.width / 100) * cw);
            let targetH = Math.round((op.height / 100) * ch);

            if (op.text) {
              // Generate text watermark SVG
              const fontSize = Math.round(targetH * 0.8);
              const textSvg = `
                <svg width="${targetW}" height="${targetH}">
                  <style>
                    .text { fill: rgba(255, 255, 255, ${op.opacity || 0.5}); font-family: sans-serif; font-weight: bold; font-size: ${fontSize}px; }
                  </style>
                  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="text">${op.text}</text>
                </svg>
              `;
              overlayBuffer = Buffer.from(textSvg);
            } else if (op.image) {
              const overlayImg = Buffer.from(op.image.split(',')[1], 'base64');
              let overlayPipeline = sharp(overlayImg).resize(targetW, targetH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
              
              if (op.opacity !== undefined && op.opacity < 1) {
                const mask = Buffer.from(
                  `<svg width="${targetW}" height="${targetH}"><rect x="0" y="0" width="${targetW}" height="${targetH}" fill="rgba(255,255,255,${op.opacity})" /></svg>`
                );
                overlayPipeline = overlayPipeline.composite([{
                  input: mask,
                  blend: 'dest-in'
                }]);
              }
              overlayBuffer = await overlayPipeline.toBuffer();
            }

            if (overlayBuffer) {
              const left = Math.round((op.x / 100) * cw - (targetW / 2));
              const top = Math.round((op.y / 100) * ch - (targetH / 2));

              pipeline = pipeline.composite([{
                input: overlayBuffer,
                left: Math.max(0, Math.min(cw - targetW, left)),
                top: Math.max(0, Math.min(ch - targetH, top)),
              }]);
            }
            break;
        }
      }

      const formatOptions: any = {};
      if (['jpg', 'jpeg', 'webp', 'avif'].includes(targetFormat)) {
        formatOptions.quality = quality;
      }

      const outputBuffer = await pipeline.toFormat(targetFormat as any, formatOptions).toBuffer();
      
      // Cleanup
      fs.unlinkSync(req.file.path);

      res.set('Content-Type', `image/${targetFormat === 'jpg' ? 'jpeg' : targetFormat}`);
      res.send(outputBuffer);
    } catch (error) {
      console.error('Processing error:', error);
      res.status(500).json({ error: 'Failed to process image' });
      if (req.file) fs.unlinkSync(req.file.path);
    }
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
