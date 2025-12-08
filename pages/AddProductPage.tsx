import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Product, ProductProfile, AppSettings, ModelTier, ExpertMode, BackgroundTask } from '../types';
import { db } from '../services/db';
import { generateUUID } from '../services/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, Loader2, Sparkles, X, ImagePlus, Globe, RotateCcw, Save, Trash2, ExternalLink, ZoomIn, Edit2, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Toggle } from '../components/Toggle';

const STORAGE_KEY = 'authentiqc_temp_product';

interface TempData {
  step: 'UPLOAD' | 'REVIEW';
  images: string[];
  productUrl: string;
  profile: ProductProfile | null;
  generatedSettings: AppSettings | null;
}

export const AddProductPage = () => {
  const { user, settings, addProduct, startIdentificationTask, tasks, dismissTask } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [images, setImages] = useState<string[]>([]);
  const [productUrl, setProductUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'UPLOAD' | 'REVIEW'>('UPLOAD');
  const [profile, setProfile] = useState<ProductProfile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [generatedSettings, setGeneratedSettings] = useState<AppSettings | null>(null);
  // Local toggles for identification flow (per-request)
  const [localModelTier, setLocalModelTier] = useState<ModelTier>(settings.modelTier);
  const [localExpertMode, setLocalExpertMode] = useState<ExpertMode>(settings.expertMode);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);

  const idTasks = tasks.filter(t => t.type === 'IDENTIFY');

  useEffect(() => {
    const taskIdFromUrl = searchParams.get('reviewTaskId');
    if (taskIdFromUrl) {
        const task = tasks.find(t => t.id === taskIdFromUrl);
        if (task && task.status === 'COMPLETED' && task.result) {
            setProfile(task.result);
            setImages(task.meta.images || []);
            setProductUrl(task.meta.url || '');
            setGeneratedSettings(task.meta.settings || settings);
            setStep('REVIEW');
            setReviewingTaskId(taskIdFromUrl);
            // remove the taskId from the URL so it's not processed again on refresh
            searchParams.delete('reviewTaskId');
            setSearchParams(searchParams, {replace: true});
        }
    }
  }, [searchParams, tasks, settings, setSearchParams]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data: TempData = JSON.parse(saved);
        if (step === 'UPLOAD' && data.images) {
             setImages(data.images || []);
             setProductUrl(data.productUrl || '');
             setStep(data.step || 'UPLOAD');
             setProfile(data.profile || null);
             setGeneratedSettings(data.generatedSettings || null);
        }
      } catch (e) {
        console.error("Failed to load temp data", e);
      }
    }
  }, []);

  useEffect(() => {
    const data: TempData = {
      step,
      images,
      productUrl,
      profile,
      generatedSettings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [step, images, productUrl, profile, generatedSettings]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (step !== 'UPLOAD') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.clipboardData && e.clipboardData.items) {
        const items = Array.from(e.clipboardData.items);
        items.forEach(item => {
          if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => {
                 setImages(prev => [...prev, reader.result as string]);
              };
              reader.readAsDataURL(file);
            }
          }
        });
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [step]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

  const handleIdentify = () => {
    if (!user?.apiKey) {
      alert("Please add your API Key in settings first.");
      return;
    }
    if (images.length === 0 && !productUrl) {
      alert("Please add at least one image or a Product URL.");
      return;
    }

    const useSettings: AppSettings = { modelTier: localModelTier, expertMode: localExpertMode };
    startIdentificationTask(user.apiKey, images, productUrl || undefined, useSettings);
    localStorage.removeItem(STORAGE_KEY);
    setImages([]);
    setProductUrl('');
  };

  const handleTaskClick = (task: BackgroundTask) => {
      if (task.status === 'COMPLETED' && task.result) {
          setProfile(task.result);
          setImages(task.meta.images || []);
          setProductUrl(task.meta.url || '');
          setGeneratedSettings(task.meta.settings || settings);
          setStep('REVIEW');
          setReviewingTaskId(task.id);
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const handleRedo = (e: React.MouseEvent) => {
    e.preventDefault();
    setStep('UPLOAD');
    setProfile(null);
    setGeneratedSettings(null);
  };

  const handleDiscard = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.confirm("Are you sure you want to discard this draft?")) {
      if (reviewingTaskId) {
        dismissTask(reviewingTaskId);
      }
      setImages([]);
      setProductUrl('');
      setProfile(null);
      setGeneratedSettings(null);
      setStep('UPLOAD');
      setSelectedImage(null);
      setIsEditingUrl(false);
      setLoading(false);
      setReviewingTaskId(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!profile) {
        return;
    }

    setLoading(true);
    
    try {
      const imageIds: string[] = [];
      
      // Save images with safe UUIDs
      for (const img of images) {
        const id = generateUUID();
        await db.saveImage(id, img);
        imageIds.push(id);
      }
      
      // Create Product with safe UUID
      const newProduct: Product = {
        id: generateUUID(),
        profile,
        referenceImageIds: imageIds,
        qcBatches: [],
        reports: [],
        createdAt: Date.now(),
        creationSettings: generatedSettings || settings
      };

      await addProduct(newProduct);
      
      // Only clear storage and navigate on success
      localStorage.removeItem(STORAGE_KEY);
      navigate('/inventory');
    } catch (err: any) {
      console.error("Save failed:", err);
      alert(`Error saving product: ${err.message || 'Unknown error'}. Please check your connection.`);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'REVIEW' && profile && generatedSettings) {
    return (
      <div className="space-y-4 pb-24 relative">
        {selectedImage && (
            <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
            <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full">
                <X size={32} />
            </button>
            <img 
                src={selectedImage} 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
                onClick={(e) => e.stopPropagation()} 
            />
            </div>
        )}

        <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Review Product</h1>
            <div className="flex gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${generatedSettings.modelTier === ModelTier.DETAILED ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                    {generatedSettings.modelTier === ModelTier.DETAILED ? 'Pro 3.0' : 'Flash 2.5'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${generatedSettings.expertMode === ExpertMode.EXPERT ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                    {generatedSettings.expertMode === ExpertMode.EXPERT ? 'Expert' : 'Normal'}
                </span>
            </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
           <div className="flex flex-col md:flex-row gap-4">
              <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:w-32 md:h-64 scrollbar-thin scrollbar-thumb-gray-200 flex-shrink-0">
                  {images.length > 0 ? images.map((img, i) => (
                      <div key={i} className="relative group cursor-pointer flex-shrink-0" onClick={() => setSelectedImage(img)}>
                         <img src={img} className="h-16 w-16 md:h-24 md:w-24 object-cover rounded-lg border border-gray-100" />
                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all rounded-lg flex items-center justify-center">
                             <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100" />
                         </div>
                      </div>
                  )) : (
                      <div className="h-16 w-full bg-gray-50 rounded-lg flex items-center justify-center text-[10px] text-gray-400 border border-gray-100 p-2 text-center">No Images</div>
                  )}
              </div>

              <div className="flex-1 grid grid-cols-2 gap-3">
                 <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-0.5">Product Name</label>
                    <input 
                      value={profile.name} 
                      onChange={e => setProfile({...profile, name: e.target.value})}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary outline-none font-bold text-slate-800"
                    />
                 </div>
                 
                 <div>
                    <label className="block text-xs font-medium text-slate-500 mb-0.5">Brand</label>
                    <input 
                      value={profile.brand} 
                      onChange={e => setProfile({...profile, brand: e.target.value})}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary outline-none"
                    />
                 </div>
                 
                 <div>
                    <label className="block text-xs font-medium text-slate-500 mb-0.5">Category</label>
                    <input 
                      value={profile.category} 
                      onChange={e => setProfile({...profile, category: e.target.value})}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary outline-none"
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-medium text-slate-500 mb-0.5">Price Est.</label>
                    <input 
                      value={profile.priceEstimate} 
                      onChange={e => setProfile({...profile, priceEstimate: e.target.value})}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary outline-none"
                    />
                 </div>
                 
                 <div>
                    <label className="block text-xs font-medium text-slate-500 mb-0.5">Material</label>
                    <input 
                      value={profile.material} 
                      onChange={e => setProfile({...profile, material: e.target.value})}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary outline-none"
                    />
                 </div>

                 <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-0.5">Features</label>
                    <textarea 
                        value={(profile.features || []).join(', ')} 
                        onChange={e => setProfile({...profile, features: e.target.value.split(', ')})} 
                        rows={2} 
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary outline-none resize-none" 
                    />
                 </div>

                 <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-0.5 flex justify-between items-center">
                      <span>Product URL</span>
                      {profile.url && (
                          <div className="flex gap-2">
                             <a href={profile.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 text-[10px]"><ExternalLink size={10}/> Open Link</a>
                             <button onClick={() => setIsEditingUrl(!isEditingUrl)} className="text-gray-500 hover:text-gray-800 text-[10px] flex items-center gap-1"><Edit2 size={10}/> {isEditingUrl ? 'Done' : 'Edit'}</button>
                          </div>
                      )}
                    </label>
                    
                    {isEditingUrl || !profile.url ? (
                        <div className="relative">
                            <Globe size={14} className="absolute left-3 top-2 text-gray-400" />
                            <input 
                                value={profile.url || ''} 
                                onChange={e => setProfile({...profile, url: e.target.value})}
                                placeholder="https://..."
                                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary outline-none text-slate-600 bg-gray-50" 
                            />
                        </div>
                    ) : (
                        <a href={profile.url} target="_blank" rel="noreferrer" className="block w-full px-3 py-1.5 text-sm border border-transparent bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors truncate">
                            {profile.url}
                        </a>
                    )}
                 </div>
              </div>
           </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-gray-200 relative z-10">
            <button 
                type="button"
                onClick={handleDiscard} 
                className="col-span-1 py-3 px-4 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 flex items-center justify-center gap-2 text-sm z-10"
            >
                <Trash2 size={16} /> <span className="hidden sm:inline">Discard</span>
            </button>
            <button 
                type="button"
                onClick={handleRedo} 
                className="col-span-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 flex items-center justify-center gap-2 text-sm z-10"
            >
                <RotateCcw size={16} /> Redo
            </button>
            <button 
                type="button"
                onClick={handleSave} 
                disabled={loading} 
                className="col-span-2 md:col-span-2 py-3 px-6 rounded-xl bg-primary text-white font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 text-sm z-10"
            >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Save to Inventory</>}
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-2xl font-bold">Add New Product</h1>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h2 className="font-bold text-gray-800">1. Upload Images</h2>
              <div className="mt-3 flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Model</label>
                {/* <Toggle
                  labelLeft="Fast"
                  labelRight="Detailed"
                  value={modelTier === 'DETAILED'}
                  onChange={(isDetailed) => setModelTier(isDetailed ? 'DETAILED' : 'FAST')}
                /> */}
                <div className="relative group">
                  <Info size={16} className="text-gray-400 cursor-pointer" />
                  <div className="absolute bottom-full mb-2 w-64 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <p><span className="font-semibold">Flash 2.5:</span> Faster, more cost-effective model, suitable for most identification tasks.</p>
                    <p className="mt-1"><span className="font-semibold">Pro 3.0:</span> More powerful model for higher accuracy, but slower and more expensive.</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500">Add photos for visual identification.</p>
          </div>
          <div 
            className={`p-8 text-center space-y-6 transition-all duration-200 ${
                isDragging ? 'bg-indigo-50 ring-2 ring-primary ring-inset' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-wrap justify-center gap-4 min-h-[120px] items-center">
                {images.length === 0 && (
                    <div className="flex flex-col items-center text-gray-400 pointer-events-none select-none">
                        <ImagePlus size={48} className="mb-2 opacity-50" />
                        <p>Drag & Drop images here</p>
                        <p className="text-sm mt-1">or Paste from clipboard (Ctrl+V)</p>
                    </div>
                )}
                {images.map((img, i) => (
                    <div key={i} className="relative group animate-in fade-in zoom-in duration-300">
                        <img src={img} className="h-32 w-32 object-cover rounded-xl shadow-sm bg-white border border-gray-200" />
                        <button onClick={() => removeImage(i)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X size={12} /></button>
                    </div>
                ))}
            </div>
            
            <div className="flex justify-center">
                <label className="cursor-pointer">
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <div className="flex items-center gap-2 bg-white text-slate-700 px-6 py-2 rounded-full font-semibold hover:bg-gray-50 transition shadow-sm border border-gray-200">
                        <Upload size={18} /> Choose Files
                    </div>
                </label>
            </div>
          </div>
      </div>

      <div className="flex items-center gap-4">
          <div className="h-px bg-gray-300 flex-1"></div>
          <span className="text-sm font-bold text-gray-400 uppercase">AND / OR</span>
          <div className="h-px bg-gray-300 flex-1"></div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bold text-gray-800">2. Product URL</h2>
            <p className="text-sm text-gray-500">Provide a link for precise identification.</p>
        </div>
        <div className="p-6">
            <div className="flex items-center gap-3 border border-gray-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary transition-all">
                <Globe className="text-gray-400" />
                <input 
                    type="text" 
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://brand.com/product/..." 
                    className="flex-1 outline-none text-gray-700 bg-transparent"
                />
            </div>
        </div>
      </div>

      <button 
        onClick={handleIdentify}
        disabled={(images.length === 0 && !productUrl) || loading}
        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
            (images.length === 0 && !productUrl) ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-primary to-accent text-white hover:shadow-indigo-200 hover:scale-[1.01] active:scale-[0.99]'
        }`}
      >
        <Sparkles /> Start Identification Task
      </button>

      {idTasks.length > 0 && (
          <div className="mt-10 animate-in slide-in-from-bottom-5 fade-in duration-500">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Identifications</h3>
              <div className="grid grid-cols-1 gap-3">
                  {idTasks.map((task) => (
                      <div 
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className={`bg-white rounded-xl p-4 border shadow-sm transition-all relative overflow-hidden group ${
                            task.status === 'COMPLETED' ? 'hover:shadow-md cursor-pointer border-gray-200 hover:border-primary/30' : 'border-blue-100 bg-blue-50/30'
                        }`}
                      >
                          <div className="flex items-center gap-4">
                              <div className="h-16 w-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-100 relative">
                                  {task.meta.images && task.meta.images.length > 0 ? (
                                      <img src={task.meta.images[0]} className="h-full w-full object-cover" />
                                  ) : (
                                      <div className="flex items-center justify-center h-full text-gray-300"><Globe size={24} /></div>
                                  )}
                                  {task.status === 'PROCESSING' && (
                                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                          <Loader2 className="text-white animate-spin" size={20} />
                                      </div>
                                  )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-gray-500">{new Date(task.createdAt).toLocaleTimeString()}</span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                          task.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                                          task.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                      }`}>
                                          {task.status}
                                      </span>
                                  </div>
                                  <h4 className="font-bold text-slate-800 truncate">
                                      {task.status === 'COMPLETED' && task.result?.name ? task.result.name : task.meta.subtitle || 'Identifying Product...'}
                                  </h4>
                                  <p className="text-xs text-slate-500 truncate mt-0.5">
                                      {task.status === 'PROCESSING' ? 'AI is analyzing images...' : 
                                       task.status === 'COMPLETED' ? 'Click to review and save' : task.error}
                                  </p>
                              </div>

                              {task.status === 'COMPLETED' && (
                                  <div className="text-gray-300 group-hover:text-primary transition-colors">
                                      <ZoomIn size={20} />
                                  </div>
                              )}
                          </div>
                          {task.status === 'PROCESSING' && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-100">
                                  <div className="h-full bg-blue-500 animate-progress origin-left"></div>
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};
