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
  Eraser
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
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'adjust' | 'filters' | 'history'>('adjust');
  const [metadata, setMetadata] = useState<any>(null);

  const [adjustments, setAdjustments] = useState({
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    gamma: 1,
    grayscale: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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
        grayscale: false
      });
    }
  };

  const addOperation = (op: Omit<Operation, 'id'>) => {
    const newOp = { ...op, id: Math.random().toString(36).substr(2, 9) };
    const nextOps = [...operations, newOp];
    updateOperations(nextOps);
  };

  const updateOperations = (nextOps: Operation[]) => {
    setOperations(nextOps);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(nextOps);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
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
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800">PIXELCRAFT<span className="font-normal text-slate-500 ml-1 italic border-l border-slate-200 pl-2">Studio</span></h1>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Result
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left Mini Sidebar */}
        <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 space-y-4 shrink-0">
          <SidebarIcon icon={Settings2} active={activeTab === 'adjust'} onClick={() => setActiveTab('adjust')} />
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
                        "max-w-full max-h-[60vh] object-contain rounded shadow-sm",
                        activeTool === 'text' && "cursor-crosshair"
                      )}
                    />
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
                    <MiniTool icon={Eraser} label="Clean BG" onClick={() => addOperation({ type: 'remove-bg' })} />
                    <MiniTool icon={Type} label="Add Text" onClick={() => setActiveTool('text')} />
                    <MiniTool icon={CornerUpLeft} label="Rounded" onClick={() => addOperation({ type: 'rounded', radius: 20 })} />
                  </div>

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
                      PixelCraft Studio focuses on high-quality conversion. All changes are rendered server-side and updated live in the preview.
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
          <span className="text-slate-300/40">PIXELCRAFT_OS R24.1</span>
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
      <div className={cn("w-full h-12 rounded mb-2 bg-slate-200", preset)} />
      <span className="text-[10px] font-bold text-slate-500 uppercase group-hover:text-blue-600">{name}</span>
    </button>
  );
}
