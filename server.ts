import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

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
      
      let pipeline = sharp(req.file.path);

      for (const op of operations) {
        switch (op.type) {
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
          case 'rounded':
            const metadata = await sharp(req.file.path).metadata();
            const width = metadata.width || 0;
            const height = metadata.height || 0;
            const radius = Math.min(width, height) * (op.radius / 100);
            const mask = Buffer.from(
              `<svg><rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" /></svg>`
            );
            pipeline = pipeline.composite([{
              input: mask,
              blend: 'dest-in'
            }]);
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
