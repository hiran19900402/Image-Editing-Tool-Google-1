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
  Palette
} from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
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
  const [targetFormat, setTargetFormat] = useState<Format>('png');
  const [quality, setQuality] = useState(80);
  const [activeTab, setActiveTab] = useState<'edit' | 'convert'>('edit');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setProcessedUrl(null);
      setOperations([]);
      fetchMetadata(selectedFile);
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

  const addOperation = (op: Omit<Operation, 'id'>) => {
    setOperations(prev => [...prev, { ...op, id: Math.random().toString(36).substr(2, 9) }]);
  };

  const removeOperation = (id: string) => {
    setOperations(prev => prev.filter(op => op.id !== id));
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
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-current" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800">PIXELCRAFT<span className="font-normal text-slate-500 ml-2 italic">Studio</span></h1>
          <nav className="ml-8 flex space-x-1">
            <button 
              onClick={() => setActiveTab('edit')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                activeTab === 'edit' ? "bg-slate-100 text-blue-600" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              Adjustments
            </button>
            <button 
              onClick={() => setActiveTab('convert')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                activeTab === 'convert' ? "bg-slate-100 text-blue-600" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              Conversion
            </button>
          </nav>
        </div>
        
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
              Export Result
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left Mini Sidebar */}
        <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 space-y-4 shrink-0">
          <SidebarIcon icon={ImageIcon} active={activeTab === 'edit'} onClick={() => setActiveTab('edit')} />
          <SidebarIcon icon={Files} active={activeTab === 'convert'} onClick={() => setActiveTab('convert')} />
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
                    <p className="text-slate-400 text-sm mt-1">Start by uploading a high-resolution image</p>
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
                      className="max-w-full max-h-[60vh] object-contain rounded shadow-sm"
                    />
                    {isProcessing && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 rounded">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Processing...</span>
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

          {/* Canvas Controls */}
          {file && (
            <div className="h-12 flex items-center justify-center space-x-6 mt-4">
               <button className="flex items-center px-4 py-1.5 bg-white border border-slate-200 rounded text-sm font-medium hover:bg-slate-50 transition-colors">
                 <Maximize2 className="w-4 h-4 mr-2 text-slate-400" />
                 Fit View
               </button>
               <div className="text-[11px] text-slate-500 font-mono bg-white px-3 py-1 rounded border border-slate-200 uppercase">
                 {metadata?.space || 'RGB'} • {metadata?.depth || '8'}-bit
               </div>
               <button 
                onClick={processImage}
                disabled={isProcessing}
                className="flex items-center px-6 py-1.5 bg-slate-800 text-white rounded text-sm font-bold hover:bg-slate-900 transition-all disabled:opacity-50"
               >
                 <Zap className="w-4 h-4 mr-2" />
                 Apply Pipeline
               </button>
            </div>
          )}
        </section>

        {/* Property Panel */}
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0">
          <div className="p-5 border-b border-slate-100 bg-[#FBFBFB]">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-4">
              {activeTab === 'edit' ? 'Image Processing' : 'Conversion Flow'}
            </h3>
            
            {activeTab === 'convert' ? (
              <div className="space-y-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Output Format</label>
                  <select 
                    value={targetFormat}
                    onChange={(e) => setTargetFormat(e.target.value as Format)}
                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    {SUPPORTED_FORMATS.map(fmt => (
                      <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                {['jpeg', 'webp', 'avif'].includes(targetFormat) && (
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Quality</label>
                      <span className="text-xs font-mono text-blue-600 font-bold">{quality}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      value={quality} 
                      onChange={(e) => setQuality(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setActiveTool('resize')}
                  className={cn(
                    "flex items-center justify-center p-2 text-[10px] font-bold border rounded transition-all",
                    activeTool === 'resize' ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  RESIZE
                </button>
                <button 
                  onClick={() => addOperation({ type: 'rounded', radius: 10 })}
                  className="flex items-center justify-center p-2 text-[10px] font-bold border border-slate-200 rounded bg-slate-50 text-slate-700 hover:border-blue-300 transition-all"
                >
                  ROUND CORNERS
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {activeTab === 'edit' && (
              <div className="space-y-6">
                {activeTool === 'resize' && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dimensions</span>
                      <button onClick={() => setActiveTool(null)}><X className="w-3 h-3 text-slate-400" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase">W (px)</label>
                        <input id="resize-w" type="number" className="w-full h-8 bg-white border border-slate-200 rounded text-xs px-2" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase">H (px)</label>
                        <input id="resize-h" type="number" className="w-full h-8 bg-white border border-slate-200 rounded text-xs px-2" />
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
                      className="w-full py-2 bg-blue-600 text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      Process Resize
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Visual Effects</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniTool icon={Filter} label="Gray" onClick={() => addOperation({ type: 'grayscale' })} />
                    <MiniTool icon={Zap} label="Sharp" onClick={() => addOperation({ type: 'sharpen' })} />
                    <MiniTool icon={Contrast} label="Thres" onClick={() => addOperation({ type: 'threshold', value: 128 })} />
                    <MiniTool icon={Ghost} label="Blur" onClick={() => addOperation({ type: 'blur', sigma: 5 })} />
                    <MiniTool icon={Scaling} label="Mirror" onClick={() => addOperation({ type: 'flop' })} />
                    <MiniTool icon={RotateCw} label="Flip V" onClick={() => addOperation({ type: 'flip' })} />
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Active Stack</h3>
                  <div className="space-y-2">
                    {operations.length === 0 ? (
                      <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-xl">
                        <p className="text-[10px] font-medium text-slate-300 italic uppercase">No filters applied</p>
                      </div>
                    ) : (
                      operations.map(op => (
                        <div key={op.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg group">
                          <div className="flex items-center space-x-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            <span className="text-xs font-semibold text-slate-600 capitalize">{op.type}</span>
                          </div>
                          <button onClick={() => removeOperation(op.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-500 transition-colors" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {metadata && (
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Total Operations</span>
                  <span className="font-bold text-slate-600 font-mono">{operations.length}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Memory Pressure</span>
                  <span className="font-bold text-green-500 font-mono tracking-tighter">STABLE</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-200">
             <button 
                onClick={processImage}
                disabled={!file || isProcessing}
                className="w-full py-4 bg-blue-600 text-white rounded-lg font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
             >
               {isProcessing ? 'Processing Pixels...' : 'Generate & Export'}
             </button>
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


function InfoItem({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider font-mono">{label}</span>
      <p className="text-sm font-medium text-white/80">{value}</p>
    </div>
  );
}
