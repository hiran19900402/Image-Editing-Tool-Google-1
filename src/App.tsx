import { 
  Upload, 
  Image as ImageIcon, 
  RotateCw, 
  Scaling, 
  Crop, 
  Download, 
  Settings2, 
  Filter, 
  Zap, 
  Files, 
  Type, 
  Layers, 
  Ghost, 
  CornerUpLeft,
  X,
  Loader2,
  Trash2,
  Maximize2,
  Contrast,
  Palette,
  Eraser,
  Sparkles
} from 'lucide-react';
import React, { useState, useCallback, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

// --- Types ---
type Format = 'png' | 'jpeg' | 'webp' | 'avif' | 'gif' | 'tiff' | 'svg' | 'ico';

interface Operation {
  id: string;
  type: string;
  [key: string]: any;
}

const SUPPORTED_FORMATS: Format[] = ['png', 'jpeg', 'webp', 'avif', 'gif', 'tiff', 'svg', 'ico'];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [debouncedOperations, setDebouncedOperations] = useState<Operation[]>([]);
  const [history, setHistory] = useState<Operation[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [targetFormat, setTargetFormat] = useState<Format>('png');
  const [quality, setQuality] = useState(80);
  const [processedSize, setProcessedSize] = useState<number | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'adjust' | 'filters' | 'history' | 'optimize'>('adjust');
  const [metadata, setMetadata] = useState<any>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [brushColor, setBrushColor] = useState('#EF4444');
  const [drawMode, setDrawMode] = useState<'brush' | 'eraser' | 'line' | 'rect' | 'circle'>('brush');
  const [drawOpacity, setDrawOpacity] = useState(1);

  const [adjustments, setAdjustments] = useState({
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    gamma: 1,
    blur: 0,
    grayscale: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const onOverlayFileChange = (e: ChangeEvent<HTMLInputElement>, type: 'overlay' | 'watermark') => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        addOperation({ 
          type, 
          image: base64, 
          x: 50, 
          y: 50, 
          width: type === 'watermark' ? 15 : 40, 
          height: type === 'watermark' ? 15 : 40,
          opacity: type === 'watermark' ? 0.5 : 1
        });
        setActiveTool(type);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOperations(operations);
    }, 400);
    return () => clearTimeout(timer);
  }, [operations]);

  useEffect(() => {
    if (file) {
      processImage();
    }
  }, [debouncedOperations, targetFormat, quality]);

  // History sync
  useEffect(() => {
    if (historyIndex === -1 && operations.length > 0) {
      setHistory([operations]);
      setHistoryIndex(0);
    }
  }, [operations]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setProcessedUrl(null);
      setOperations([]);
      setHistory([]);
      setHistoryIndex(-1);
      fetchMetadata(selectedFile);
      setAdjustments({
        brightness: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
        gamma: 1,
        blur: 0,
        grayscale: false
      });
    }
  };

  const addOperation = (op: Omit<Operation, 'id'>) => {
    setOperations(prev => {
      // For rotate, we want to stack them by combining into one operation with summed angle
      if (op.type === 'rotate') {
        const rotateIdx = prev.findIndex(o => o.type === 'rotate');
        if (rotateIdx > -1) {
          const nextOps = [...prev];
          const currentAngle = nextOps[rotateIdx].angle || 0;
          const newAngle = (currentAngle + (op as any).angle) % 360;
          nextOps[rotateIdx] = { ...nextOps[rotateIdx], angle: newAngle };
          updateOperationsDirect(nextOps);
          return nextOps;
        }
      }
      
      const newOp = { ...op, id: Math.random().toString(36).substr(2, 9) };
      const nextOps = [...prev, newOp];
      updateOperationsDirect(nextOps);
      return nextOps;
    });
  };

  const updateOperationsDirect = (nextOps: Operation[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(nextOps);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const updateOperations = (nextOps: Operation[]) => {
    setOperations(nextOps);
    updateOperationsDirect(nextOps);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevOps = history[historyIndex - 1];
      setOperations(prevOps);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextOps = history[historyIndex + 1];
      setOperations(nextOps);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const updateAdjustment = (key: string, value: any) => {
    const nextAdjustments = { ...adjustments, [key]: value };
    setAdjustments(nextAdjustments);
    
    // Check if we already have an adjust operation
    const adjustIdx = operations.findIndex(op => op.type === 'adjust');
    if (adjustIdx > -1) {
      const nextOps = [...operations];
      nextOps[adjustIdx] = { ...nextOps[adjustIdx], ...nextAdjustments };
      setOperations(nextOps);
      // We don't push to history for every slider movement to avoid bloat
      // maybe we should debounce history push
    } else {
      addOperation({ type: 'adjust', ...nextAdjustments });
    }
  };

  const fetchMetadata = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('/api/metadata', { method: 'POST', body: formData });
      const data = await res.json();
      setMetadata(data);
    } catch (err) {
      console.error(err);
    }
  };

  const processImage = async () => {
    if (!file) return;
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('operations', JSON.stringify(operations));
    formData.append('targetFormat', targetFormat === 'jpeg' ? 'jpg' : targetFormat);
    formData.append('quality', quality.toString());

    try {
      const res = await fetch('/api/process', { method: 'POST', body: formData });
      if (res.ok) {
        const blob = await res.blob();
        setProcessedSize(blob.size);
        if (processedUrl) URL.revokeObjectURL(processedUrl);
        setProcessedUrl(URL.createObjectURL(blob));
      } else {
        console.error('Failed to process image');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = () => {
    if (!processedUrl) return;
    const a = document.createElement('a');
    a.href = processedUrl;
    a.download = `pixelcraft-output.${targetFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#F8FAFC] text-slate-900 font-sans select-none overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-white shadow-lg shadow-amber-200">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <h1 id="app-title" className="text-lg font-bold tracking-tight text-slate-800">VIP IMAGE<span className="font-normal text-slate-500 ml-1 italic border-l border-slate-200 pl-2">Studio</span></h1>
        </div>
        
          <div className="flex items-center space-x-2">
            <button 
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
              title="Undo"
            >
              <CornerUpLeft className="w-5 h-5 text-slate-600" />
            </button>
            <button 
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors rotate-180"
              title="Redo"
            >
              <CornerUpLeft className="w-5 h-5 text-slate-600" />
            </button>
          </div>
          <div className="w-px h-6 bg-slate-200" />
          <div className="flex items-center space-x-3">
          {file && (
            <div className="flex items-center bg-slate-100 px-3 py-1 rounded-full text-[11px] font-mono text-slate-500 space-x-2">
              <span>{metadata?.format?.toUpperCase() || '-'}</span>
              <div className="w-px h-3 bg-slate-300"></div>
              <span>{metadata?.width}x{metadata?.height}</span>
            </div>
          )}
          {processedUrl && (
            <button 
              onClick={downloadImage}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2 group"
            >
              <Download className="w-4 h-4 group-active:translate-y-0.5 transition-transform" />
              <div className="flex flex-col items-start leading-tight">
                <span>Download Result</span>
                {processedSize && <span className="text-[9px] opacity-70 font-mono tracking-tighter">Approx. {formatBytes(processedSize)}</span>}
              </div>
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left Mini Sidebar */}
        <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 space-y-4 shrink-0">
          <SidebarIcon icon={Settings2} active={activeTab === 'adjust'} onClick={() => setActiveTab('adjust')} />
          <SidebarIcon icon={Zap} active={activeTab === 'optimize'} onClick={() => setActiveTab('optimize')} />
          <SidebarIcon icon={Filter} active={activeTab === 'filters'} onClick={() => setActiveTab('filters')} />
          <SidebarIcon icon={Layers} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <div className="w-8 h-px bg-slate-100"></div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <Upload className="w-6 h-6" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={onFileChange} 
            className="hidden" 
            accept="image/*"
          />
        </aside>

        {/* Workspace */}
        <section className="flex-1 flex flex-col bg-slate-100 p-6 relative">
          <div className="flex-1 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center bg-white shadow-inner overflow-hidden relative group">
            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-6 p-12 text-center"
                >
                  <div className="w-32 h-32 bg-blue-500 rounded-3xl rotate-12 mb-4 flex items-center justify-center text-white shadow-xl">
                    <Upload className="w-16 h-16" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Drop your project files here</h2>
                    <p className="text-slate-400 text-sm mt-1">Select an image to start converting and editing</p>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    Select Local File
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full p-8 flex items-center justify-center"
                >
                  <div className="relative max-w-full max-h-full bg-slate-50 p-2 rounded-lg shadow-2xl">
                    <div className="relative" ref={previewContainerRef}>
                      <img 
                        src={processedUrl || previewUrl!} 
                        alt="Preview" 
                        onClick={(e) => {
                          if (activeTool === 'text') {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - rect.left) / rect.width) * 100;
                            const y = ((e.clientY - rect.top) / rect.height) * 100;
                            
                            const idx = operations.findIndex(op => op.type === 'text');
                            if (idx > -1) {
                              const nextOps = [...operations];
                              nextOps[idx] = { ...nextOps[idx], x, y };
                              setOperations(nextOps);
                            }
                          }
                        }}
                        className={cn(
                          "max-w-full max-h-[60vh] object-contain rounded shadow-sm block",
                          activeTool === 'text' && "cursor-crosshair",
                          activeTool === 'crop' && "cursor-cell"
                        )}
                      />
                      
                      {activeTool === 'crop' && (
                        <CropOverlay 
                          onConfirm={(area) => {
                            if (metadata) {
                              const left = Math.max(0, Math.floor((area.x / 100) * metadata.width));
                              const top = Math.max(0, Math.floor((area.y / 100) * metadata.height));
                              const width = Math.min(metadata.width - left, Math.floor((area.width / 100) * metadata.width));
                              const height = Math.min(metadata.height - top, Math.floor((area.height / 100) * metadata.height));
                              
                              if (width > 0 && height > 0) {
                                addOperation({ type: 'crop', left, top, width, height });
                                setActiveTool(null);
                              }
                            }
                          }}
                          onCancel={() => setActiveTool(null)}
                        />
                      )}

                      {activeTool === 'eraser' && (
                        <EraserOverlay 
                          brushSize={brushSize}
                          onConfirm={(path) => {
                            if (!path) return;
                            addOperation({ type: 'erase', path, size: brushSize });
                            setActiveTool(null);
                          }}
                          onCancel={() => setActiveTool(null)}
                        />
                      )}

                      {(activeTool === 'overlay' || activeTool === 'watermark') && (
                        <div className="absolute inset-0 z-10 pointer-events-none">
                          <OverlayPreview 
                            type={activeTool}
                            operation={operations.find(op => op.type === activeTool)}
                            onUpdate={(updates) => {
                              const idx = operations.findIndex(op => op.type === activeTool);
                              if (idx > -1) {
                                const nextOps = [...operations];
                                nextOps[idx] = { ...nextOps[idx], ...updates };
                                setOperations(nextOps);
                              }
                            }}
                          />
                        </div>
                      )}

                      {activeTool === 'draw' && (
                        <DrawingOverlay 
                          size={brushSize}
                          color={brushColor}
                          mode={drawMode}
                          opacity={drawOpacity}
                          onConfirm={(data) => {
                            addOperation({ type: 'draw', ...data, size: brushSize, color: brushColor, mode: drawMode, opacity: drawOpacity });
                            setActiveTool(null);
                          }}
                          onCancel={() => setActiveTool(null)}
                        />
                      )}
                    </div>
                    {isProcessing && (
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-lg border border-blue-100 flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Processing...</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {file && (
              <div className="absolute top-4 right-4 flex space-x-2">
                <button 
                  onClick={() => setProcessedUrl(null)}
                  className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-white text-[10px] font-bold uppercase rounded backdrop-blur transition-all"
                >
                  Original
                </button>
                <button 
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setProcessedUrl(null);
                    setOperations([]);
                  }}
                  className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white text-[10px] font-bold uppercase rounded backdrop-blur transition-all"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Status Indicators */}
          {file && (
            <div className="h-10 flex items-center justify-center mt-4">
               <div className="text-[11px] text-slate-400 font-mono bg-white px-3 py-1 rounded-full border border-slate-200 uppercase flex items-center gap-3 shadow-sm">
                 <span>{metadata?.space || 'RGB'} • {metadata?.depth || '8'}-bit</span>
                 <div className="w-px h-3 bg-slate-200" />
                 <span className="text-blue-500 font-bold">Auto-Updating Active</span>
               </div>
            </div>
          )}
        </section>

        {/* Tool Panel */}
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {!file ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                <Settings2 className="w-12 h-12 mb-4 text-slate-300" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Upload Image to Begin</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* 1. Global Output - MOST IMPORTANT */}
                <section className="p-5 space-y-4 bg-blue-600 text-white shadow-inner">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Conversion Output</h3>
                    <span className="text-[10px] font-mono font-bold bg-white/20 px-2 py-0.5 rounded italic">Primary</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase opacity-60">Format</label>
                      <select 
                        value={targetFormat}
                        onChange={(e) => setTargetFormat(e.target.value as Format)}
                        className="w-full bg-white text-slate-900 border-none rounded-md px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-400 outline-none transition-all cursor-pointer"
                      >
                        {SUPPORTED_FORMATS.map(fmt => (
                          <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center opacity-60">
                        <label className="text-[10px] font-bold uppercase">Quality</label>
                        <span className="text-[10px] font-mono font-bold">{quality}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="10" 
                        max="100" 
                        value={quality} 
                        onChange={(e) => setQuality(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </div>
                </section>

                {/* 2. AI Enhancements */}
                <section className="p-5 space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">AI Powered Tools</h3>
                  <button 
                    onClick={() => addOperation({ type: 'remove-bg' })}
                    className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-400 transition-all group"
                  >
                    <Eraser className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Remove Background (AI)</span>
                  </button>
                </section>

                {/* 2. Content based on Tab */}
                {activeTab === 'optimize' && (
                  <section className="p-5 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Optimization Engine</h3>
                      
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>File Size Comparison</span>
                          <span className="text-blue-500">Live</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-white rounded-xl border border-slate-100">
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Original</p>
                            <p className="text-sm font-black text-slate-700">{formatBytes(file?.size || 0)}</p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-[9px] font-bold text-blue-400 uppercase mb-1">Optimized</p>
                            <p className="text-sm font-black text-blue-600">{formatBytes(processedSize || 0)}</p>
                          </div>
                        </div>

                        {processedSize && file && processedSize < file.size && (
                          <div className="bg-emerald-50 text-emerald-600 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-tight flex items-center justify-between">
                            <span>Total Savings</span>
                            <span>{Math.round((1 - processedSize / file.size) * 100)}%</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Compression Level</label>
                          <span className="text-[10px] font-mono font-bold text-blue-600 px-2 py-0.5 bg-blue-50 rounded italic">{quality}% Quality</span>
                        </div>
                        <input 
                          type="range" 
                          min="5" 
                          max="100" 
                          step="1"
                          value={quality} 
                          onChange={(e) => setQuality(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-[8px] font-black text-slate-300 uppercase tracking-widest">
                          <span>Max Compress</span>
                          <span>Max Quality</span>
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                         <div className="flex items-start gap-3">
                           <div className="p-1.5 bg-amber-200 rounded-lg">
                             <Settings2 className="w-3 h-3 text-amber-700" />
                           </div>
                           <div className="space-y-1">
                             <p className="text-[10px] font-black text-amber-900 uppercase">Optimization Tip</p>
                             <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                               Lowering quality significantly reduces file size. WebP and AVIF formats generally offer better compression than JPEG at the same quality level.
                             </p>
                           </div>
                         </div>
                      </div>
                    </div>
                  </section>
                )}
                {activeTab === 'adjust' && (
                  <section className="p-5 space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tone & Light</h4>
                      <AdjustmentSlider 
                        label="Brightness" 
                        min={0} max={3} step={0.01} 
                        value={adjustments.brightness} 
                        onChange={(v) => updateAdjustment('brightness', v)} 
                      />
                      <AdjustmentSlider 
                        label="Contrast" 
                        min={0.1} max={3} step={0.01} 
                        value={adjustments.contrast} 
                        onChange={(v) => updateAdjustment('contrast', v)} 
                      />
                      <AdjustmentSlider 
                        label="Gamma" 
                        min={1} max={3} step={0.1} 
                        value={adjustments.gamma} 
                        onChange={(v) => updateAdjustment('gamma', v)} 
                      />
                      <AdjustmentSlider 
                        label="Blur" 
                        min={0} max={20} step={0.1} 
                        value={adjustments.blur} 
                        onChange={(v) => updateAdjustment('blur', v)} 
                      />
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Color Balance</h4>
                      <AdjustmentSlider 
                        label="Saturation" 
                        min={0} max={3} step={0.01} 
                        value={adjustments.saturation} 
                        onChange={(v) => updateAdjustment('saturation', v)} 
                      />
                      <AdjustmentSlider 
                        label="Hue" 
                        min={0} max={360} step={1} 
                        value={adjustments.hue} 
                        onChange={(v) => updateAdjustment('hue', v)} 
                      />
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-600 uppercase">Monochrome</span>
                        <button 
                          onClick={() => updateAdjustment('grayscale', !adjustments.grayscale)}
                          className={cn(
                            "w-8 h-4 rounded-full relative transition-colors",
                            adjustments.grayscale ? "bg-blue-600" : "bg-slate-300"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                            adjustments.grayscale ? "left-4.5" : "left-0.5"
                          )} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Geometry</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <MiniTool icon={RotateCw} label="Rotate 90" onClick={() => addOperation({ type: 'rotate', angle: 90 })} />
                        <MiniTool icon={Scaling} label="Mirror" onClick={() => addOperation({ type: 'flop' })} />
                        <MiniTool icon={Crop} label="Crop Tool" onClick={() => setActiveTool('crop')} />
                      </div>
                      <button 
                        onClick={() => setActiveTool('resize')}
                        className="w-full h-9 flex items-center justify-center bg-slate-800 text-white text-[10px] font-bold uppercase rounded-lg"
                      >
                        Resize Image
                      </button>
                    </div>
                  </section>
                )}

                {activeTab === 'filters' && (
                  <section className="p-5 grid grid-cols-2 gap-3">
                    <FilterCard name="Natural" preset="natural" onClick={() => addOperation({ type: 'filter', name: 'natural' })} />
                    <FilterCard name="Vivid" preset="vivid" onClick={() => addOperation({ type: 'filter', name: 'vivid' })} />
                    <FilterCard name="Warm" preset="warm" onClick={() => addOperation({ type: 'filter', name: 'warm' })} />
                    <FilterCard name="Cool" preset="cool" onClick={() => addOperation({ type: 'filter', name: 'cool' })} />
                    <FilterCard name="Vintage" preset="vintage" onClick={() => addOperation({ type: 'filter', name: 'vintage' })} />
                    <FilterCard name="Mono" preset="mono" onClick={() => addOperation({ type: 'filter', name: 'mono' })} />
                    <FilterCard name="Soft" preset="soft" onClick={() => addOperation({ type: 'filter', name: 'soft' })} />
                    <FilterCard name="Color Pop" preset="color-pop" onClick={() => addOperation({ type: 'filter', name: 'color-pop' })} />
                    <FilterCard name="Duotone" preset="duotone" onClick={() => addOperation({ type: 'filter', name: 'duotone' })} />
                  </section>
                )}

                {activeTab === 'history' && (
                  <section className="p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operations</h3>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500">{operations.length} Steps</span>
                    </div>
                    <div className="space-y-2">
                      {operations.map((op, idx) => (
                        <div key={op.id} className="flex items-center justify-between p-2.5 bg-slate-50/50 border border-slate-100 rounded-lg group hover:border-blue-100 transition-colors">
                          <div className="flex items-center space-x-2.5">
                            <span className="text-[9px] font-mono text-slate-400">#{idx+1}</span>
                            <span className="text-[10px] font-bold text-slate-600 capitalize tracking-tight">{op.type}</span>
                          </div>
                          <button onClick={() => updateOperations(operations.filter(o => o.id !== op.id))}>
                            <Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-500 transition-colors" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Always visible tools */}
                <section className="p-5 border-t border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Quick Tools</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniTool icon={Sparkles} label="Eraser AI" onClick={() => addOperation({ type: 'remove-bg' })} />
                    <MiniTool icon={Palette} label="Paint Layer" onClick={() => setActiveTool('draw')} />
                    <MiniTool icon={Eraser} label="BG Erase" onClick={() => setActiveTool('eraser')} />
                    <MiniTool icon={Files} label="Overlay" onClick={() => overlayInputRef.current?.click()} />
                    <MiniTool icon={Type} label="Text Watermark" onClick={() => {
                      addOperation({ 
                        type: 'watermark', 
                        text: 'WATERMARK', 
                        x: 50, 
                        y: 50, 
                        width: 30, 
                        height: 10,
                        opacity: 0.5 
                      });
                      setActiveTool('watermark');
                    }} />
                    <MiniTool icon={Ghost} label="Img Watermark" onClick={() => watermarkInputRef.current?.click()} />
                    <MiniTool icon={Crop} label="Crop" onClick={() => setActiveTool('crop')} />
                    <MiniTool icon={Type} label="Add Text" onClick={() => setActiveTool('text')} />
                  </div>

                  <input 
                    type="file" 
                    ref={overlayInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => onOverlayFileChange(e, 'overlay')}
                  />
                  <input 
                    type="file" 
                    ref={watermarkInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => onOverlayFileChange(e, 'watermark')}
                  />

                  {activeTool === 'eraser' && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                           <Eraser className="w-3 h-3" /> Manual Eraser
                         </span>
                         <X className="w-4 h-4 text-slate-300 cursor-pointer hover:text-slate-600" onClick={() => setActiveTool(null)} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Brush Size</label>
                          <span id="brush-size-val" className="text-[10px] font-mono font-bold text-amber-600">{brushSize}px</span>
                        </div>
                        <input 
                          id="brush-size"
                          type="range" min="1" max="100" value={brushSize}
                          onChange={(e) => {
                            setBrushSize(parseInt(e.currentTarget.value));
                          }}
                          className="w-full h-1 bg-amber-100 rounded accent-amber-600"
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 italic leading-tight">Drag on the image to erase parts manually. Click confirm to apply.</p>
                    </div>
                  )}

                  {activeTool === 'draw' && (
                    <div className="mt-4 p-5 rounded-xl bg-rose-50 border border-rose-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                          <Palette className="w-3 h-3" /> Paint & Draw
                        </span>
                        <X className="w-4 h-4 text-slate-300 cursor-pointer hover:text-slate-600" onClick={() => setActiveTool(null)} />
                      </div>
                      
                      <div className="grid grid-cols-5 gap-1 shadow-sm rounded-lg overflow-hidden border border-rose-200">
                        {(['brush', 'eraser', 'line', 'rect', 'circle'] as const).map(m => (
                          <button 
                            key={m}
                            onClick={() => setDrawMode(m)}
                            className={cn(
                              "h-8 flex items-center justify-center text-[10px] font-black uppercase tracking-tight transition-all",
                              drawMode === m ? "bg-rose-500 text-white" : "bg-white text-rose-300 hover:text-rose-500"
                            )}
                          >
                            {m.charAt(0)}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2 items-center overflow-x-auto pb-1 custom-scrollbar scrollbar-none">
                        {['#000000', '#FFFFFF', '#6B7280', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#78350F'].map(c => (
                          <button 
                            key={c}
                            onClick={() => setBrushColor(c)}
                            className={cn(
                              "w-5 h-5 rounded-full border-2 shrink-0 transition-transform active:scale-90",
                              brushColor === c ? "border-rose-500 scale-110" : "border-white"
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <input 
                          type="color" 
                          value={brushColor} 
                          onChange={(e) => setBrushColor(e.target.value)}
                          className="w-5 h-5 bg-transparent border-0 p-0 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-4">
                        <AdjustmentSlider 
                          label="Brush Size" min={1} max={100} step={1} 
                          value={brushSize} 
                          onChange={setBrushSize}
                        />
                        <AdjustmentSlider 
                          label="Opacity" min={0.1} max={1} step={0.01} 
                          value={drawOpacity} 
                          onChange={setDrawOpacity}
                        />
                      </div>

                      <p className="text-[9px] text-rose-700 italic border-t border-rose-100 pt-3">Draw directly on the image. Changes appear in real-time as an overlay layer.</p>
                      <button 
                        onClick={() => setActiveTool(null)}
                        className="w-full py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                      >
                        Apply Drawing
                      </button>
                    </div>
                  )}

                  {(activeTool === 'overlay' || activeTool === 'watermark') && (
                    <div className="mt-4 p-5 rounded-xl bg-violet-50 border border-violet-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                       <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-2">
                           {activeTool === 'overlay' ? <Files className="w-3 h-3" /> : <Ghost className="w-3 h-3" />} 
                           {activeTool === 'overlay' ? 'Layer Image' : 'Digital Watermark'}
                         </span>
                         <X className="w-4 h-4 text-slate-300 cursor-pointer hover:text-slate-600" onClick={() => setActiveTool(null)} />
                       </div>
                       
                       <div className="space-y-4">
                        {activeTool === 'watermark' && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Watermark Text</label>
                              <button 
                                onClick={() => watermarkInputRef.current?.click()}
                                className="text-[8px] font-black text-violet-600 uppercase hover:underline"
                              >
                                Or Use Image
                              </button>
                            </div>
                            <input 
                              type="text"
                              value={(operations.find(op => op.type === 'watermark') as any)?.text || ''}
                              onChange={(e) => {
                                const idx = operations.findIndex(op => op.type === 'watermark');
                                if (idx > -1) {
                                  const nextOps = [...operations];
                                  nextOps[idx] = { ...nextOps[idx], text: e.target.value, image: null };
                                  setOperations(nextOps);
                                }
                              }}
                              placeholder="Type watermark..."
                              className="w-full h-8 bg-white border border-violet-200 rounded text-xs px-2 focus:ring-1 focus:ring-violet-400 outline-none"
                            />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <AdjustmentSlider 
                            label="Pos X (%)" min={0} max={100} step={1} 
                            value={(operations.find(op => op.type === activeTool) as any)?.x || 50} 
                            onChange={(v) => {
                              const idx = operations.findIndex(op => op.type === activeTool);
                              if (idx > -1) {
                                const nextOps = [...operations];
                                nextOps[idx] = { ...nextOps[idx], x: v };
                                setOperations(nextOps);
                              }
                            }}
                          />
                          <AdjustmentSlider 
                            label="Pos Y (%)" min={0} max={100} step={1} 
                            value={(operations.find(op => op.type === activeTool) as any)?.y || 50} 
                            onChange={(v) => {
                              const idx = operations.findIndex(op => op.type === activeTool);
                              if (idx > -1) {
                                const nextOps = [...operations];
                                nextOps[idx] = { ...nextOps[idx], y: v };
                                setOperations(nextOps);
                              }
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <AdjustmentSlider 
                            label="Width (%)" min={5} max={100} step={1} 
                            value={(operations.find(op => op.type === activeTool) as any)?.width || 40} 
                            onChange={(v) => {
                              const idx = operations.findIndex(op => op.type === activeTool);
                              if (idx > -1) {
                                const nextOps = [...operations];
                                nextOps[idx] = { ...nextOps[idx], width: v };
                                setOperations(nextOps);
                              }
                            }}
                          />
                          <AdjustmentSlider 
                            label="Height (%)" min={5} max={100} step={1} 
                            value={(operations.find(op => op.type === activeTool) as any)?.height || 40} 
                            onChange={(v) => {
                              const idx = operations.findIndex(op => op.type === activeTool);
                              if (idx > -1) {
                                const nextOps = [...operations];
                                nextOps[idx] = { ...nextOps[idx], height: v };
                                setOperations(nextOps);
                              }
                            }}
                          />
                        </div>
                        <AdjustmentSlider 
                          label="Opacity" min={0.1} max={1} step={0.01} 
                          value={(operations.find(op => op.type === activeTool) as any)?.opacity || 1} 
                          onChange={(v) => {
                             const idx = operations.findIndex(op => op.type === activeTool);
                            if (idx > -1) {
                              const nextOps = [...operations];
                              nextOps[idx] = { ...nextOps[idx], opacity: v };
                              setOperations(nextOps);
                            }
                          }}
                        />
                       </div>

                       <button 
                         onClick={() => setActiveTool(null)}
                         className="w-full py-2 bg-violet-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all"
                       >
                         Apply & Lock
                       </button>
                    </div>
                  )}

                  {activeTool === 'crop' && (
                    <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white">
                          <Crop className="w-3 h-3" />
                        </div>
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">DRAG ON IMAGE TO CROP</span>
                      </div>
                      <button 
                        onClick={() => setActiveTool(null)}
                        className="text-blue-400 hover:text-blue-600 font-bold text-[10px] uppercase"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {activeTool === 'text' && (
                    <div className="mt-4 p-5 rounded-xl bg-white border-2 border-blue-500 shadow-xl shadow-blue-100 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Text Overlay Editor</span>
                         <X className="w-4 h-4 text-slate-300 cursor-pointer hover:text-slate-600" onClick={() => setActiveTool(null)} />
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Text Content</label>
                          <input 
                            defaultValue=""
                            onInput={(e) => {
                              const val = e.currentTarget.value;
                              const idx = operations.findIndex(op => op.type === 'text');
                              if (idx > -1) {
                                const nextOps = [...operations];
                                nextOps[idx] = { ...nextOps[idx], text: val };
                                setOperations(nextOps);
                              } else {
                                addOperation({ type: 'text', text: val, color: '#ffffff', fontFamily: 'Inter, sans-serif', fontSize: 64, x: 50, y: 50 });
                              }
                            }}
                            type="text" 
                            placeholder="Layer Text..." 
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded text-sm px-3 outline-none focus:border-blue-500 transition-colors" 
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Position X (%)</label>
                            <input 
                              type="range" min="0" max="100" defaultValue="50"
                              onChange={(e) => {
                                const idx = operations.findIndex(op => op.type === 'text');
                                if (idx > -1) {
                                  const nextOps = [...operations];
                                  nextOps[idx] = { ...nextOps[idx], x: parseInt(e.currentTarget.value) };
                                  setOperations(nextOps);
                                }
                              }}
                              className="w-full h-1 bg-slate-100 rounded accent-blue-600"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Position Y (%)</label>
                            <input 
                              type="range" min="0" max="100" defaultValue="50"
                              onChange={(e) => {
                                const idx = operations.findIndex(op => op.type === 'text');
                                if (idx > -1) {
                                  const nextOps = [...operations];
                                  nextOps[idx] = { ...nextOps[idx], y: parseInt(e.currentTarget.value) };
                                  setOperations(nextOps);
                                }
                              }}
                              className="w-full h-1 bg-slate-100 rounded accent-blue-600"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Font Size</label>
                            <span className="text-[10px] font-mono font-bold text-blue-600">
                              {(operations.find(op => op.type === 'text') as any)?.fontSize || 64}px
                            </span>
                          </div>
                          <input 
                            type="range" min="12" max="300" 
                            defaultValue="64"
                            onChange={(e) => {
                              const val = parseInt(e.currentTarget.value);
                              const idx = operations.findIndex(op => op.type === 'text');
                              if (idx > -1) {
                                const nextOps = [...operations];
                                nextOps[idx] = { ...nextOps[idx], fontSize: val };
                                setOperations(nextOps);
                              }
                            }}
                            className="w-full h-1 bg-slate-100 rounded accent-blue-600"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Text Font</label>
                            <select 
                              onChange={(e) => {
                                const val = e.currentTarget.value;
                                const idx = operations.findIndex(op => op.type === 'text');
                                if (idx > -1) {
                                  const nextOps = [...operations];
                                  nextOps[idx] = { ...nextOps[idx], fontFamily: val };
                                  setOperations(nextOps);
                                }
                              }}
                              className="w-full h-9 bg-slate-50 border border-slate-200 rounded text-[10px] px-2 font-bold focus:border-blue-500"
                            >
                              <option value="Inter, sans-serif">INTER (Modern)</option>
                              <option value="'Space Grotesk', sans-serif">SPACE GROTESK</option>
                              <option value="'Outfit', sans-serif">OUTFIT (Tech)</option>
                              <option value="'Montserrat', sans-serif">MONTSERRAT (Bold)</option>
                              <option value="'Bebas Neue', sans-serif">BEBAS NEUE (Impact)</option>
                              <option value="'Lobster', cursive">LOBSTER (Display)</option>
                              <option value="'Dancing Script', cursive">DANCING SCRIPT</option>
                              <option value="'Playfair Display', serif">PLAYFAIR (Serif)</option>
                              <option value="'JetBrains Mono', monospace">JETBRAINS MONO</option>
                            </select>
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Fill</label>
                            <input 
                              type="color" 
                              defaultValue="#ffffff" 
                              onChange={(e) => {
                                const val = e.currentTarget.value;
                                const idx = operations.findIndex(op => op.type === 'text');
                                if (idx > -1) {
                                  const nextOps = [...operations];
                                  nextOps[idx] = { ...nextOps[idx], color: val };
                                  setOperations(nextOps);
                                }
                              }}
                              className="w-9 h-9 p-1 bg-slate-50 border border-slate-200 rounded cursor-pointer" 
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => {
                              const active = e.currentTarget.classList.toggle('bg-blue-600');
                              e.currentTarget.classList.toggle('text-white');
                              const idx = operations.findIndex(op => op.type === 'text');
                              if (idx > -1) {
                                const nextOps = [...operations];
                                nextOps[idx] = { ...nextOps[idx], bold: active };
                                setOperations(nextOps);
                              }
                            }} 
                            className="flex-1 h-9 flex items-center justify-center border border-slate-200 rounded text-xs font-bold hover:bg-slate-50 transition-colors"
                          >B</button>
                          <button 
                            onClick={(e) => {
                              const active = e.currentTarget.classList.toggle('bg-blue-600');
                              e.currentTarget.classList.toggle('text-white');
                              const idx = operations.findIndex(op => op.type === 'text');
                              if (idx > -1) {
                                const nextOps = [...operations];
                                nextOps[idx] = { ...nextOps[idx], italic: active };
                                setOperations(nextOps);
                              }
                            }} 
                            className="flex-1 h-9 flex items-center justify-center border border-slate-200 rounded text-xs italic hover:bg-slate-50 transition-colors"
                          >I</button>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => setActiveTool(null)}
                        className="w-full py-3 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-700 transition-transform active:scale-95 shadow-lg shadow-blue-100"
                      >
                        Confirm Layer
                      </button>
                    </div>
                  )}

                  {activeTool === 'resize' && (
                    <div className="mt-4 p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400">WIDTH</label>
                          <input id="resize-w" type="number" placeholder="px" className="w-full h-8 bg-slate-50 border border-slate-200 rounded text-xs px-2" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400">HEIGHT</label>
                          <input id="resize-h" type="number" placeholder="px" className="w-full h-8 bg-slate-50 border border-slate-200 rounded text-xs px-2" />
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          const w = parseInt((document.getElementById('resize-w') as HTMLInputElement).value);
                          const h = parseInt((document.getElementById('resize-h') as HTMLInputElement).value);
                          if (w || h) {
                            addOperation({ type: 'resize', width: w || null, height: h || null });
                            setActiveTool(null);
                          }
                        }}
                        className="w-full py-2 bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-widest"
                      >
                        Update Canvas
                      </button>
                    </div>
                  )}
                </section>

                <section className="p-5 space-y-4 bg-slate-50/20">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">About this tool</h3>
                  <div className="p-4 rounded-lg bg-white border border-slate-200">
                    <p className="text-[10px] text-slate-400 leading-relaxed italic">
                      VIP Image Studio focuses on high-quality conversion. All changes are rendered server-side and updated live in the preview.
                    </p>
                  </div>
                </section>
              </div>
            )}
          </div>

          <div className="p-5 bg-white border-t border-slate-100">
             <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Process Queue</span>
                <span className="text-xs font-mono font-bold text-blue-600">{isProcessing ? 'BUSY' : 'SYNCED'}</span>
             </div>
             {processedUrl && (
                <button 
                  onClick={downloadImage}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-center"
                >
                  Download Result
                </button>
             )}
          </div>
        </aside>
      </main>

      {/* Footer / Status Bar */}
      <footer className="h-8 bg-slate-800 text-slate-400 flex items-center justify-between px-4 text-[10px] shrink-0 border-t border-white/5 font-medium uppercase tracking-widest">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
             <span className={cn("w-1.5 h-1.5 rounded-full", file ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-slate-500")}></span>
             <span>{file ? 'READY FOR PROCESS' : 'IDLE'}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span>Buffer: CLEAR</span>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex space-x-1 items-center">
            <span className="text-[9px] text-slate-500">ENGINE:</span>
            <span className="text-slate-300">SHARP v0.32.1</span>
          </div>
          <span className="text-slate-300/40">VIP_STUDIO_OS R24.1</span>
        </div>
      </footer>
    </div>
  );
}

function SidebarIcon({ icon: Icon, active, onClick }: { icon: any, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2.5 rounded-lg transition-all",
        active 
          ? "bg-blue-50 text-blue-600 shadow-sm" 
          : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      )}
    >
      <Icon className="w-6 h-6" />
    </button>
  );
}

function MiniTool({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all group"
    >
      <Icon className="w-4 h-4 text-slate-400 group-hover:text-blue-500 mb-1.5 transition-colors" />
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter group-hover:text-slate-600">{label}</span>
    </button>
  );
}


function AdjustmentSlider({ label, min, max, step, value, onChange }: { label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
        <span className="text-[10px] font-mono text-blue-600 font-bold">{value.toFixed(2)}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
    </div>
  );
}

function FilterCard({ name, preset, onClick }: { name: string, preset: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center group hover:border-blue-300 transition-all"
    >
      <div className={cn("w-full h-12 rounded mb-2 bg-slate-200 shadow-inner", preset)} />
      <span className="text-[10px] font-bold text-slate-500 uppercase group-hover:text-blue-600 tracking-tight">{name}</span>
    </button>
  );
}

function formatBytes(bytes: number, decimals: number = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function CropOverlay({ onConfirm, onCancel }: { onConfirm: (area: { x: number, y: number, width: number, height: number }) => void, onCancel: () => void }) {
  const [currentArea, setCurrentArea] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startResize = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    setIsResizing(handle);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isResizing) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentArea({ x, y, width: 0, height: 0 });
    setIsResizing('new');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isResizing || !containerRef.current || !currentArea) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (isResizing === 'new') {
      const left = Math.min(x, currentArea.x);
      const top = Math.min(y, currentArea.y);
      const width = Math.abs(x - currentArea.x);
      const height = Math.abs(y - currentArea.y);
      setCurrentArea({ x: left, y: top, width, height });
    } else if (isResizing === 'nw') {
      const right = currentArea.x + currentArea.width;
      const bottom = currentArea.y + currentArea.height;
      const newX = Math.min(x, right - 1);
      const newY = Math.min(y, bottom - 1);
      setCurrentArea({ x: newX, y: newY, width: right - newX, height: bottom - newY });
    } else if (isResizing === 'ne') {
      const bottom = currentArea.y + currentArea.height;
      const newWidth = Math.max(1, x - currentArea.x);
      const newY = Math.min(y, bottom - 1);
      setCurrentArea({ ...currentArea, y: newY, width: newWidth, height: bottom - newY });
    } else if (isResizing === 'sw') {
      const right = currentArea.x + currentArea.width;
      const newX = Math.min(x, right - 1);
      const newHeight = Math.max(1, y - currentArea.y);
      setCurrentArea({ x: newX, y: currentArea.y, width: right - newX, height: newHeight });
    } else if (isResizing === 'se') {
      const newWidth = Math.max(1, x - currentArea.x);
      const newHeight = Math.max(1, y - currentArea.y);
      setCurrentArea({ ...currentArea, width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsResizing(null);
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-10 cursor-crosshair overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {currentArea && (
        <div 
          className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] z-20 group"
          style={{
            left: `${currentArea.x}%`,
            top: `${currentArea.y}%`,
            width: `${currentArea.width}%`,
            height: `${currentArea.height}%`
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Handles */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-600 border border-white cursor-nw-resize z-30" onMouseDown={(e) => startResize(e, 'nw')} />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-600 border border-white cursor-ne-resize z-30" onMouseDown={(e) => startResize(e, 'ne')} />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-600 border border-white cursor-sw-resize z-30" onMouseDown={(e) => startResize(e, 'sw')} />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-600 border border-white cursor-se-resize z-30" onMouseDown={(e) => startResize(e, 'se')} />
          
          {/* Action Button */}
          {currentArea.width > 5 && currentArea.height > 5 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 items-center pointer-events-auto">
              <button 
                onClick={() => onConfirm(currentArea)}
                className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                title="Apply Crop"
              >
                <Crop className="w-3 h-3" />
              </button>
              <button 
                onClick={onCancel}
                className="bg-white text-slate-600 p-2 rounded-full shadow-lg hover:bg-slate-50 active:scale-95 transition-all"
                title="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="absolute inset-0 border border-black/20 pointer-events-none" />
        </div>
      )}
    </div>
  );
}

function OverlayPreview({ type, operation, onUpdate }: { type: string, operation: any, onUpdate: (updates: any) => void }) {
  if (!operation || !operation.image) return null;
  
  return (
    <div 
      className="absolute border-2 border-dashed border-violet-400 z-20 pointer-events-auto cursor-move flex items-center justify-center overflow-hidden"
      style={{
        left: `${operation.x}%`,
        top: `${operation.y}%`,
        width: `${operation.width}%`,
        height: `${operation.height}%`,
        transform: 'translate(-50%, -50%)',
        opacity: operation.opacity || 1
      }}
    >
      {operation.text ? (
        <span className="text-white font-bold whitespace-nowrap select-none" style={{ fontSize: 'clamp(8px, 4vw, 40px)' }}>
          {operation.text}
        </span>
      ) : (
        <img src={operation.image} alt="Overlay" className="w-full h-full object-contain" />
      )}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest whitespace-nowrap">
        {type === 'watermark' ? (operation.text ? 'Text Watermark' : 'Logo Watermark') : 'Image Layer'}
      </div>
    </div>
  );
}

function DrawingOverlay({ onConfirm, onCancel, size, color, mode, opacity }: { 
  onConfirm: (data: any) => void, 
  onCancel: () => void, 
  size: number, 
  color: string, 
  mode: 'brush' | 'eraser' | 'line' | 'rect' | 'circle',
  opacity: number
}) {
  const [points, setPoints] = useState<{ x: number, y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number, y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getEventPos = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getEventPos(e);
    if (!pos) return;
    setIsDrawing(true);
    setStartPos(pos);
    setCurrentPos(pos);
    if (mode === 'brush' || mode === 'eraser') {
      setPoints([pos]);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getEventPos(e);
    if (!pos) return;
    setCurrentPos(pos);
    if (isDrawing && (mode === 'brush' || mode === 'eraser')) {
      setPoints(prev => [...prev, pos]);
    }
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (mode === 'brush' || mode === 'eraser') {
      if (points.length > 1) {
        const path = points.reduce((acc, p, i) => {
          return acc + (i === 0 ? `M ${p.x.toFixed(3)} ${p.y.toFixed(3)}` : ` L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`);
        }, "");
        onConfirm({ path });
      }
    } else if (startPos && currentPos) {
      onConfirm({ x1: startPos.x, y1: startPos.y, x2: currentPos.x, y2: currentPos.y });
    }
    
    setPoints([]);
    setStartPos(null);
    setCurrentPos(null);
  };

  const renderCurrentShape = () => {
    if (!isDrawing || !startPos || !currentPos) return null;
    const strokeWidth = size / (containerRef.current?.clientWidth ? containerRef.current.clientWidth / 100 : 1);
    
    if (mode === 'brush' || mode === 'eraser') {
      const path = points.reduce((acc, p, i) => {
        return acc + (i === 0 ? `M ${p.x.toFixed(3)} ${p.y.toFixed(3)}` : ` L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`);
      }, "");
      return (
        <path 
          d={path} 
          fill="none" 
          stroke={mode === 'eraser' ? 'rgba(255,255,255,0.4)' : color} 
          strokeWidth={strokeWidth} 
          opacity={opacity}
          strokeLinecap="round" 
          strokeJoin="round" 
          strokeDasharray={mode === 'eraser' ? '1 1' : 'none'}
        />
      );
    }

    if (mode === 'line') {
      return <line x1={startPos.x} y1={startPos.y} x2={currentPos.x} y2={currentPos.y} stroke={color} strokeWidth={strokeWidth} opacity={opacity} strokeLinecap="round" />;
    }

    if (mode === 'rect') {
      const rx = Math.min(startPos.x, currentPos.x);
      const ry = Math.min(startPos.y, currentPos.y);
      const rw = Math.abs(currentPos.x - startPos.x);
      const rh = Math.abs(currentPos.y - startPos.y);
      return <rect x={rx} y={ry} width={rw} height={rh} fill="none" stroke={color} strokeWidth={strokeWidth} opacity={opacity} />;
    }

    if (mode === 'circle') {
      const r = Math.sqrt(Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2));
      return <circle cx={startPos.x} cy={startPos.y} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} opacity={opacity} />;
    }
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-20 cursor-crosshair overflow-hidden touch-none"
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      <svg className="absolute inset-0 pointer-events-none w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {renderCurrentShape()}
        {currentPos && (
          <circle 
            cx={currentPos.x} 
            cy={currentPos.y} 
            r={(size / 2) / (containerRef.current?.clientWidth ? containerRef.current.clientWidth / 100 : 1)} 
            fill="none" 
            stroke={color} 
            strokeWidth="0.2"
            opacity="0.3"
          />
        )}
      </svg>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-lg border border-rose-100 flex items-center gap-3">
        <div className="bg-rose-500 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Active Drawing</div>
        <button onClick={onCancel} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase">Cancel</button>
      </div>
    </div>
  );
}

function EraserOverlay({ onConfirm, onCancel, brushSize }: { onConfirm: (path: string) => void, onCancel: () => void, brushSize: number }) {
  const [points, setPoints] = useState<{ x: number, y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDrawing(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPoints([{ x, y }]);
  };

  const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCursorPos({ x, y });

    if (!isDrawing) return;
    setPoints(prev => [...prev, { x, y }]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const generatePath = () => {
    if (points.length < 2) return "";
    return points.reduce((acc, p, i) => {
      return acc + (i === 0 ? `M ${p.x.toFixed(3)} ${p.y.toFixed(3)}` : ` L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`);
    }, "");
  };

  const svgPath = generatePath();

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-10 cursor-crosshair overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg className="absolute inset-0 pointer-events-none w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {svgPath && (
          <path 
            d={svgPath} 
            fill="none" 
            stroke="rgba(255, 255, 255, 0.6)" 
            strokeWidth={brushSize / (containerRef.current?.clientWidth ? containerRef.current.clientWidth / 100 : 1)} 
            strokeLinecap="round"
            strokeJoin="round"
          />
        )}
        {cursorPos && (
          <circle 
            cx={cursorPos.x} 
            cy={cursorPos.y} 
            r={(brushSize / 2) / (containerRef.current?.clientWidth ? containerRef.current.clientWidth / 100 : 1)} 
            fill="none" 
            stroke="white" 
            strokeWidth="0.2"
            className="opacity-50"
          />
        )}
      </svg>
      {points.length > 2 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
          <button 
            onClick={() => onConfirm(svgPath)}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-full shadow-lg hover:bg-blue-700 font-bold text-[10px] uppercase tracking-widest"
          > Apply Erase </button>
          <button 
            onClick={() => setPoints([])}
            className="bg-white text-slate-600 px-4 py-1.5 rounded-full shadow-lg hover:bg-slate-50 font-bold text-[10px] uppercase tracking-widest"
          > Reset </button>
          <button 
            onClick={onCancel}
            className="bg-slate-800 text-white px-4 py-1.5 rounded-full shadow-lg hover:bg-slate-900 font-bold text-[10px] uppercase tracking-widest"
          > Cancel </button>
        </div>
      )}
    </div>
  );
}
