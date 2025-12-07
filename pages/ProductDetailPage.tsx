import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { db } from '../services/db';
import { Product, QCReport, ModelTier, ExpertMode } from '../types';
import { Loader2, AlertTriangle, CheckCircle, XCircle, Upload, History, ExternalLink, X, ZoomIn, Zap, Brain, Activity, Trash2, ArrowUp, ArrowDown, Minus } from 'lucide-react';

export const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, products, settings, startQCTask, tasks, deleteProduct } = useApp();
  const [product, setProduct] = useState<Product | undefined>(products.find(p => p.id === id));
  const [refImages, setRefImages] = useState<string[]>([]);
  
  // UI State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
  // QC State
  const [qcImages, setQcImages] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const activeQCTask = tasks.find(t => t.type === 'QC' && t.meta.targetId === id && t.status === 'PROCESSING');
  const isRunningQC = !!activeQCTask;

  useEffect(() => {
    const p = products.find(p => p.id === id);
    setProduct(p);
    if (p) {
      Promise.all(p.referenceImageIds.map(imgId => db.getImage(imgId)))
        .then(imgs => setRefImages(imgs.filter(i => !!i) as string[]));
      
      // Select latest report by default
      if (p.reports && p.reports.length > 0) {
          setSelectedReportId(p.reports[p.reports.length - 1].id);
      }
    }
  }, [id, products]);

  const handleDelete = async () => {
    if (!product) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this entire product identification and all its data? This cannot be undone."
    );
    if (confirmed) {
      await deleteProduct(product.id);
      navigate('/inventory');
    }
  };

  // Sort reports in descending order
  const sortedReports = product?.reports?.sort((a, b) => b.generatedAt - a.generatedAt) || [];

  // Global paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.items) {
        const items = Array.from(e.clipboardData.items);
        items.forEach(item => {
          if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => {
                 setQcImages(prev => [...prev, reader.result as string]);
              };
              reader.readAsDataURL(file);
            }
          }
        });
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleQCUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (files: File[]) => {
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setQcImages(prev => [...prev, reader.result as string]);
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

  const executeQC = () => {
    if (!product || !user?.apiKey) return;
    startQCTask(user.apiKey, product, refImages, qcImages, settings);
    setQcImages([]); 
  };

  if (!product) return <div>Loading...</div>;

  const currentReport = sortedReports.find(r => r.id === selectedReportId) || sortedReports[0];
  const previousReport = selectedReportId 
    ? sortedReports[sortedReports.findIndex(r => r.id === selectedReportId) + 1]
    : sortedReports[1];

  const ReportCard = ({ report, previousReport }: { report: QCReport; previousReport?: QCReport }) => {
    const [qcReportImages, setQcReportImages] = useState<string[]>([]);

    useEffect(() => {
      if (report.qcImageIds && report.qcImageIds.length > 0) {
        Promise.all(report.qcImageIds.map(id => db.getImage(id)))
          .then(imgs => setQcReportImages(imgs.filter(Boolean) as string[]));
      }
    }, [report]);

    const getScoreDifference = (currentScore: number, prevScore?: number) => {
      if (prevScore === undefined) return null;
      const diff = currentScore - prevScore;
      if (diff > 0) return { diff, color: 'text-green-600', icon: <ArrowUp size={12} /> };
      if (diff < 0) return { diff, color: 'text-red-600', icon: <ArrowDown size={12} /> };
      return { diff, color: 'text-gray-500', icon: <Minus size={12} /> };
    };

    const overallDiff = getScoreDifference(report.overallScore, previousReport?.overallScore);

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 animate-in fade-in duration-300">
        <div className={`p-6 border-b flex justify-between items-center ${
          report.overallGrade === 'PASS' ? 'bg-green-50' : 
          report.overallGrade === 'FAIL' ? 'bg-red-50' : 'bg-yellow-50'
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
               <h3 className="font-bold text-lg">QC Analysis Report</h3>
               <div className="flex gap-1">
                   <span className={`px-1.5 py-0.5 rounded text-[10px] border ${report.modelTier === ModelTier.DETAILED ? 'bg-purple-100 border-purple-200 text-purple-700' : 'bg-green-100 border-green-200 text-green-700'}`}>{report.modelTier === ModelTier.DETAILED ? 'Pro 3.0' : 'Flash 2.5'}</span>
                   <span className={`px-1.5 py-0.5 rounded text-[10px] border ${report.expertMode === ExpertMode.EXPERT ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>{report.expertMode === ExpertMode.EXPERT ? 'Expert' : 'Normal'}</span>
               </div>
            </div>
            <p className="text-sm opacity-70">{new Date(report.generatedAt).toLocaleString()}</p>
          </div>
          <div className="text-right">
          <div className={`px-4 py-2 rounded-lg font-bold text-xl flex items-center gap-2 ${
            report.overallGrade === 'PASS' ? 'text-green-700 bg-green-100' : 
            report.overallGrade === 'FAIL' ? 'text-red-700 bg-red-100' : 'text-yellow-700 bg-yellow-100'
          }`}>
              {report.overallGrade === 'PASS' ? <CheckCircle /> : report.overallGrade === 'FAIL' ? <XCircle /> : <AlertTriangle />}
              {report.overallScore}/100
          </div>
          {overallDiff && (
            <div className={`mt-1 text-xs font-semibold flex items-center justify-end gap-1 ${overallDiff.color}`}>
              {overallDiff.icon}
              {overallDiff.diff > 0 ? `+${overallDiff.diff}` : overallDiff.diff} vs. previous
            </div>
          )}
        </div>
        </div>
        <div className="p-6 space-y-6">
          {qcReportImages.length > 0 && (
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Inspection Images</h4>
              <div className="flex flex-wrap gap-2">
                {qcReportImages.map((img, i) => (
                  <div key={i} className="relative h-16 w-16 group cursor-pointer" onClick={() => setSelectedImage(img)}>
                    <img src={img} className="h-full w-full object-cover rounded-lg border bg-white" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all rounded-lg flex items-center justify-center">
                      <ZoomIn className="text-white opacity-0 group-hover:opacity-100" size={16} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Executive Summary</h4>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{report.summary}</p>
          </div>
          
          <div className="grid gap-4">
            {report.sections.map((section, idx) => {
                const prevSection = previousReport?.sections.find(s => s.sectionName === section.sectionName);
                const sectionDiff = getScoreDifference(section.score, prevSection?.score);
                return (
                  <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="flex justify-between items-center mb-2">
                          <h4 className="font-bold text-gray-800">{section.sectionName}</h4>
                          <div className="flex items-center gap-2">
                               <div className="text-right">
                                 <span className="text-xs font-semibold text-gray-400">Score: {section.score}</span>
                                 {sectionDiff && (
                                   <div className={`text-xs font-semibold flex items-center justify-end gap-1 ${sectionDiff.color}`}>
                                     {sectionDiff.icon}
                                     {sectionDiff.diff > 0 ? `+${sectionDiff.diff}` : sectionDiff.diff}
                                   </div>
                                 )}
                               </div>
                               <span className={`text-xs font-bold px-2 py-1 rounded ${
                                    section.grade === 'PASS' ? 'bg-green-200 text-green-800' : 
                                    section.grade === 'FAIL' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                               }`}>{section.grade}</span>
                          </div>
                      </div>
                      <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                          {section.observations.split('. ').map((obs, i) => (
                         obs.trim() && <li key={i}>{obs.trim()}.</li>
                          ))}
                      </ul>
                  </div>
                )
            })}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-20 relative">
      {/* Lightbox */}
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

      {/* Product Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3">
             <div 
               className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-2 relative group cursor-pointer"
               onClick={() => refImages[0] && setSelectedImage(refImages[0])}
             >
                 {refImages.length > 0 && <img src={refImages[0]} className="w-full h-full object-cover" />}
                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                    <ZoomIn className="text-white opacity-0 group-hover:opacity-100 drop-shadow-lg" size={32} />
                 </div>
             </div>
             <div className="flex gap-2 overflow-x-auto pb-2">
                 {refImages.slice(1).map((img, i) => (
                   <div key={i} className="relative h-16 w-16 flex-shrink-0 cursor-pointer group" onClick={() => setSelectedImage(img)}>
                      <img src={img} className="h-full w-full rounded-lg object-cover border" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all rounded-lg" />
                   </div>
                 ))}
             </div>
          </div>
          <div className="flex-1">
             <div className="flex justify-between items-start">
                 <div>
                    <h1 className="text-2xl font-bold text-gray-900">{product.profile.name}</h1>
                    <p className="text-primary font-medium">{product.profile.brand}</p>
                 </div>
                 <div className="flex flex-col items-end gap-2">
                     <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide">{product.profile.category}</span>
                     {product.profile.url ? (
                        <a 
                          href={product.profile.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-semibold"
                        >
                            <ExternalLink size={16} /> Visit Official Page
                        </a>
                     ) : (
                       <span className="text-xs text-gray-400">No URL identified</span>
                     )}
                 </div>
             </div>
             
             {/* Model Info Badge */}
             {product.creationSettings && (
                 <div className="mt-2 flex gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${product.creationSettings.modelTier === ModelTier.DETAILED ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        <Zap size={10} /> {product.creationSettings.modelTier === ModelTier.DETAILED ? 'Pro 3.0 (Detailed)' : 'Flash 2.5 (Fast)'}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${product.creationSettings.expertMode === ExpertMode.EXPERT ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                        <Brain size={10} /> {product.creationSettings.expertMode === ExpertMode.EXPERT ? 'Expert Persona' : 'Normal Persona'}
                    </span>
                 </div>
             )}

             <div className="mt-6 grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                 <div><span className="text-gray-400 text-xs uppercase font-bold block mb-1">Est. Price</span><span className="font-semibold">{product.profile.priceEstimate}</span></div>
                 <div><span className="text-gray-400 text-xs uppercase font-bold block mb-1">Material</span><span className="font-semibold">{product.profile.material}</span></div>
             </div>
             

              <div className="mt-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Identifying Features</h4>
                  <div className="flex flex-wrap gap-2">
                      {product.profile.features?.map((f, i) => (
                          <span key={i} className="px-3 py-1 bg-white text-slate-700 text-xs rounded-full border border-gray-200 shadow-sm">{f}</span>
                      ))}
                  </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <button 
                  onClick={handleDelete}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors"
                >
                  <Trash2 size={16} />
                  Delete Identification
                </button>
              </div>
          </div>
        </div>
      </div>      
      {/* QC Section */}
      <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-bold">Quality Control</h2>
          <button onClick={() => setShowHistory(!showHistory)} className="text-sm text-gray-500 flex items-center gap-1 hover:text-primary transition-colors px-3 py-1 rounded-lg hover:bg-gray-100">
              <History size={16} /> {showHistory ? 'Hide History' : `History (${product.reports?.length || 0})`}
          </button>
      </div>
      
      {/* History List */}
      {showHistory && sortedReports.length > 0 && (
          <div className="mb-6 flex gap-3 overflow-x-auto pb-4">
              {sortedReports.map((r) => (
                  <div 
                    key={r.id}
                    onClick={() => setSelectedReportId(r.id)}
                    className={`min-w-[200px] p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedReportId === r.id ? 'bg-primary/5 border-primary shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'
                    }`}
                  >
                      <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                r.overallGrade === 'PASS' ? 'bg-green-100 text-green-700' : 
                                r.overallGrade === 'FAIL' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>{r.overallGrade}</span>
                          <span className="text-xs text-gray-400">{new Date(r.generatedAt).toLocaleDateString()}</span>
                      </div>
                      <p className="font-bold text-gray-800 text-sm mb-1">Score: {r.overallScore}/100</p>
                      <p className="text-[10px] text-gray-500 truncate">{r.summary}</p>
                  </div>
              ))}
          </div>
      )}

      {isRunningQC && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6 animate-pulse">
              <div className="flex justify-center mb-4">
                  <Activity className="text-blue-500 animate-bounce" size={32} />
              </div>
              <h3 className="text-blue-800 font-bold text-center mb-3">Analysis in Progress</h3>
              {activeQCTask.meta.images && activeQCTask.meta.images.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {activeQCTask.meta.images.map((img: string, i: number) => (
                    <img key={i} src={img} className="h-12 w-12 object-cover rounded-lg border bg-white" />
                  ))}
                </div>
              )}
          </div>
      )}

      {currentReport && !isRunningQC && <ReportCard report={currentReport} previousReport={previousReport} />}
      {!currentReport && !isRunningQC && (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed mb-6">
              <p className="text-gray-400">No QC reports generated yet.</p>
          </div>
      )}

      {/* New QC Batch */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-lg mb-4">Run New Inspection</h3>
          <p className="text-sm text-gray-500 mb-4">Drag & drop photos here, paste (Ctrl+V), or click to upload. New analysis will include all previously uploaded QC images.</p>
          
          <div 
             className={`flex flex-wrap gap-2 mb-4 p-4 rounded-xl border-2 border-dashed transition-colors ${isDragging ? 'border-primary bg-indigo-50' : 'border-gray-300'}`}
             onDragOver={handleDragOver}
             onDragLeave={handleDragLeave}
             onDrop={handleDrop}
          >
              {qcImages.map((img, i) => (
                  <div key={i} className="relative h-16 w-16 group cursor-pointer" onClick={() => setSelectedImage(img)}>
                    <img src={img} className="h-full w-full object-cover rounded-lg border bg-white" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all rounded-lg flex items-center justify-center">
                       <ZoomIn className="text-white opacity-0 group-hover:opacity-100" size={16} />
                    </div>
                  </div>
              ))}
              <label className="h-16 w-16 flex flex-col items-center justify-center rounded-lg cursor-pointer hover:bg-slate-50 text-gray-400 hover:text-primary transition-colors">
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleQCUpload} />
                  <Upload size={20} />
                  <span className="text-[10px] mt-1">Upload</span>
              </label>
          </div>

          <button 
            onClick={executeQC} 
            disabled={qcImages.length === 0 || isRunningQC}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${
                qcImages.length === 0 || isRunningQC ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-primary text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
            }`}
          >
              {isRunningQC ? (
                  <>
                    <Loader2 className="animate-spin" /> Analysis Running Background...
                  </>
              ) : "Start Background Analysis"}
          </button>
      </div>
    </div>
  );
};