import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getPublicImageUrl } from '../services/db';
import { Product, QCReport, ModelTier, ExpertMode } from '../types';
import { Loader2, CheckCircle, XCircle, Upload, History, ExternalLink, X, ZoomIn, Zap, Brain, Activity, Trash2 } from 'lucide-react';
import { parseObservations } from '../services/utils';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, products, settings, startQCTask, tasks, deleteProduct } = useApp();

  const product = useMemo(() => products.find(p => p.id === id), [products, id]);
  const [refImages, setRefImages] = useState<string[]>([]);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [qcImages, setQcImages] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [localModelTier, setLocalModelTier] = useState<ModelTier>(settings.modelTier);
  const [localExpertMode, setLocalExpertMode] = useState<ExpertMode>(settings.expertMode);

  const activeQCTask = tasks.find(t => t.type === 'QC' && t.meta.targetId === id && t.status === 'PROCESSING');
  const isRunningQC = !!activeQCTask;

  useEffect(() => {
    if (!product || !user?.id) return;
    setRefImages(
      product.referenceImageIds.map(imgId => getPublicImageUrl(user.id!, imgId))
    );

    if (product.reports && product.reports.length > 0) {
      // default to latest
      setSelectedReportId(product.reports[product.reports.length - 1].id);
    }
  }, [product, user?.id]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items || []);
      items.forEach(item => {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            const r = new FileReader();
            r.onload = () => setQcImages(prev => [...prev, r.result as string]);
            r.readAsDataURL(f);
          }
        }
      });
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const r = new FileReader();
      r.onload = () => setQcImages(prev => [...prev, r.result as string]);
      r.readAsDataURL(file);
    });
  };

  const handleQCUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    processFiles(Array.from(e.target.files));
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
    processFiles(Array.from(e.dataTransfer.files || []));
  };

  const executeQC = () => {
    if (!product || !user?.apiKey) return;
    const useSettings = { modelTier: localModelTier, expertMode: localExpertMode };
    startQCTask(user.apiKey, product, refImages, qcImages, useSettings);
    setQcImages([]);
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!confirm('Delete this product and all related data?')) return;
    await deleteProduct(product.id);
    navigate('/inventory');
  };

  if (!product) return <div>Loading...</div>;

  const sortedReports = (product.reports || []).slice().sort((a, b) => b.generatedAt - a.generatedAt);
  const currentReport = sortedReports.find(r => r.id === selectedReportId) || sortedReports[0];
  const previousReport = currentReport ? sortedReports[sortedReports.indexOf(currentReport) + 1] : undefined;

  const ReportCard: React.FC<{ report: QCReport; previous?: QCReport; refImages: string[]; expanded?: boolean; onToggle?: (id: string) => void }> = ({ report, previous, refImages, expanded = false, onToggle }) => {
    const [imgs, setImgs] = useState<string[]>([]);
    const { user } = useApp();

    useEffect(() => {
      if (!report.qcImageIds || report.qcImageIds.length === 0 || !user?.id) return;
      const imageUrls = report.qcImageIds.map(id => getPublicImageUrl(user.id!, id));
      setImgs(imageUrls);
    }, [report, user?.id]);

    const gradeToClasses = (grade: string) => {
      if (grade === 'PASS') return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' };
      if (grade === 'FAIL') return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' };
      return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-100' };
    };

    return (
      <div className={`bg-white rounded-2xl shadow-sm border p-6 mb-6 ${expanded ? 'ring-2 ring-primary/30' : ''}`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-3">
              <button onClick={() => onToggle?.(report.id)} className="font-bold text-left">
                QC Analysis Report
              </button>
              <div className="text-xs text-gray-400">{new Date(report.generatedAt).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full">{report.modelTier === 'FAST' ? 'Flash 2.5' : 'Pro 3.0'}</span>
                <span className="bg-purple-100 text-purple-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full">{report.expertMode}</span>
            </div>          </div>
          <div className="text-right">
            {(() => {
              const cls = gradeToClasses(report.overallGrade);
              return (
                <div className={`inline-flex items-center gap-3 px-3 py-2 rounded ${cls.bg} ${cls.text} font-bold`}>
                  <div className="text-xl">{report.overallScore}/100</div>
                  <div className="text-sm">{report.overallGrade}</div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Collapsible body */}
        <div className="overflow-hidden transition-[max-height,opacity]" style={{ maxHeight: expanded ? '2000px' : '0px', opacity: expanded ? 1 : 0, transition: 'max-height 350ms ease, opacity 300ms ease' }}>
          {imgs.length > 0 && (
            <div className="mb-4">
              <div className="flex gap-2 flex-wrap">
                {imgs.map((src, i) => (
                  <div key={i} className={`h-16 w-16 cursor-pointer ${selectedImage === src ? 'ring-2 ring-primary/50 rounded-lg' : ''}`} onClick={() => setSelectedImage(src)}>
                    <img src={src} className="h-full w-full object-cover rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          )}

        <div className="mb-4">
          <div className="text-sm text-gray-700 whitespace-pre-line">{report.summary}</div>
        </div>

          <div className="grid gap-3">
            {report.sections.map((s, idx) => {
              const cls = gradeToClasses(s.grade);
              const observations = Array.isArray(s.observations) ? s.observations : parseObservations(s.observations as any);
              // Map optional imageIds to loaded imgs
              const imgMap: Record<string,string> = {};
              if (report.qcImageIds && report.qcImageIds.length === imgs.length) {
                report.qcImageIds.forEach((id, i) => { if (imgs[i]) imgMap[id] = imgs[i]; });
              }

              return (
                <div key={idx} className="p-3 border rounded-lg bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold">{s.sectionName}</div>
                    <div className={`text-sm font-semibold px-2 py-0.5 rounded ${cls.bg} ${cls.text}`}>{s.score} — {s.grade}</div>
                  </div>
                  <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                    {observations.map((o, i) => {
                      const linkedImageId = s.imageIds && s.imageIds[i] ? s.imageIds[i] : undefined;
                      const linkedSrc = linkedImageId ? imgMap[linkedImageId] : undefined;
                      return (
                        <li key={i} className={`${linkedSrc ? 'cursor-pointer text-blue-700 hover:underline' : ''}`} onClick={() => linkedSrc && setSelectedImage(linkedSrc)}>
                          {o}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Highlight differences with images for caution/fail */}
        {(report.overallGrade === 'FAIL' || report.overallGrade === 'CAUTION') && (
          <div className="mt-4 p-3 border rounded bg-white">
            <h4 className="text-sm font-bold mb-2">Comparison Images</h4>
            <div className="flex gap-3 overflow-auto">
              {imgs.map((qc, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="text-xs text-gray-500">QC Image</div>
                  <img src={qc} className="h-28 w-28 object-cover rounded border" />
                  <div className="text-xs text-gray-500">Reference</div>
                  <img src={refImages[i] || refImages[0] || qc} className="h-28 w-28 object-cover rounded border" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Expand behavior: default expand latest
  useEffect(() => {
    if (currentReport) setExpandedReportId(currentReport.id);
  }, [currentReport]);

  return (
    <div className="pb-20 relative">
      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-4 right-4 text-white p-2">
            <X size={28} />
          </button>
          <img src={selectedImage} className="max-w-full max-h-[90vh] object-contain rounded" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow mb-6">
        <div className="flex gap-6">
          <div className="w-1/3">
            <div onClick={() => refImages[0] && setSelectedImage(refImages[0])} className="aspect-square bg-gray-100 rounded overflow-hidden mb-2">
              {refImages[0] && <img src={refImages[0]} className="w-full h-full object-cover" />}
            </div>
            <div className="flex gap-2 overflow-auto">
              {refImages.slice(1).map((r, i) => (
                <div key={i} onClick={() => setSelectedImage(r)} className="h-16 w-16 rounded overflow-hidden">
                  <img src={r} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between">
              <div>
                <h1 className="text-2xl font-bold">{product.profile.name}</h1>
                <div className="text-sm text-gray-600">{product.profile.brand}</div>
              </div>
              <div className="text-right">
                {product.profile.url ? (
                  <a href={product.profile.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600">
                    <ExternalLink size={14} />
                  </a>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {product.creationSettings && (
                <div className="px-2 py-1 rounded border text-sm">
                  {product.creationSettings.modelTier === ModelTier.DETAILED ? 'Pro 3.0' : 'Flash 2.5'}
                </div>
              )}
              {product.creationSettings && (
                <div className="px-2 py-1 rounded border text-sm">
                  {product.creationSettings.expertMode === ExpertMode.EXPERT ? 'Expert' : 'Normal'}
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded">
                <div>
                  <div className="text-xs text-gray-500">Est. Price</div>
                  <div className="font-semibold">{product.profile.priceEstimate}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Material</div>
                  <div className="font-semibold">{product.profile.material}</div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex flex-wrap gap-2">
                {product.profile.features?.map((f, i) => (
                  <span key={i} className="px-2 py-1 bg-white rounded border text-sm">{f}</span>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <button onClick={handleDelete} className="px-4 py-2 bg-red-50 text-red-600 rounded">Delete Identification</button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-bold">Quality Control</h2>
        <button onClick={() => setShowHistory(v => !v)} className="text-sm text-gray-600 flex items-center gap-2">
          <History size={16} /> {showHistory ? 'Hide History' : `History (${product.reports?.length || 0})`}
        </button>
      </div>

      {showHistory && sortedReports.length > 0 && (
        <div className="mb-6 flex gap-3 overflow-x-auto pb-4">
          {sortedReports.map(r => (
            <div key={r.id} onClick={() => setSelectedReportId(r.id)} className="min-w-[200px] p-3 border rounded">
              <div className="text-xs text-gray-500">{new Date(r.generatedAt).toLocaleDateString()}</div>
              <div className="font-bold">Score: {r.overallScore}</div>
            </div>
          ))}
        </div>
      )}

      {currentReport ? (
        <ReportCard report={currentReport} previous={previousReport} refImages={refImages} expanded={expandedReportId === currentReport.id} onToggle={(id) => setExpandedReportId(prev => prev === id ? null : id)} />
      ) : (
        <div className="text-center py-10 bg-white rounded border-dashed border">
          <div className="text-gray-500">No QC reports generated yet.</div>
        </div>
      )}

      {/* Running indicator placed near report area for clarity */}
      {isRunningQC && (
        <div className="bg-blue-50 p-3 rounded mb-6 flex items-center gap-3">
          <Activity className="text-blue-600" />
          <div className="flex-1">
            <div className="font-semibold text-blue-800">Analysis running in background</div>
            <div className="text-sm text-blue-600">The inspection is processing and will appear in history when complete.</div>
          </div>
        </div>
      )}

      {/* History (previous reports) below the latest report, descending order */}
      {sortedReports.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Previous Inspections</h3>
          <div className="space-y-3">
            {sortedReports.filter(r => r.id !== currentReport?.id).map(r => (
              <div key={r.id} onClick={() => setExpandedReportId(r.id)}>
                <ReportCard report={r} previous={undefined} refImages={refImages} expanded={expandedReportId === r.id} onToggle={(id) => setExpandedReportId(prev => prev === id ? null : id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded shadow mt-6">
        <h3 className="font-bold mb-2">Run New Inspection</h3>
        <p className="text-sm text-gray-500 mb-4">Drag, paste, or upload images to run a new inspection.</p>

<div className="mb-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Model</label>
                <Toggle
                  labelLeft="Flash 2.5"
                  labelRight="Pro 3.0"
                  value={localModelTier === ModelTier.DETAILED}
                  onChange={(isDetailed) => setLocalModelTier(isDetailed ? ModelTier.DETAILED : ModelTier.FAST)}
                />
                <div className="relative group">
                  <Info size={16} className="text-gray-400 cursor-pointer" />
                  <div className="absolute bottom-full mb-2 w-64 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <p><span className="font-semibold">Flash 2.5:</span> Faster, more cost-effective model.</p>
                    <p className="mt-1"><span className="font-semibold">Pro 3.0:</span> More powerful model for higher accuracy.</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Persona</label>
                <Toggle
                  labelLeft="Normal"
                  labelRight="Expert"
                  value={localExpertMode === ExpertMode.EXPERT}
                  onChange={(isExpert) => setLocalExpertMode(isExpert ? ExpertMode.EXPERT : ExpertMode.NORMAL)}
                />
                <div className="relative group">
                  <Info size={16} className="text-gray-400 cursor-pointer" />
                  <div className="absolute bottom-full mb-2 w-64 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                     <p><span className="font-semibold">Normal:</span> Provides a standard analysis.</p>
                     <p className="mt-1"><span className="font-semibold">Expert:</span> Provides a more detailed, in-depth analysis.</p>
                  </div>
                </div>
              </div>
            </div>

            <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`p-3 rounded border-2 border-dashed ${isDragging ? 'bg-indigo-50' : ''}`}>
          <div className="flex gap-2 flex-wrap">
            {qcImages.map((q, i) => (
              <div key={i} onClick={() => setSelectedImage(q)} className="h-16 w-16 rounded overflow-hidden">
                <img src={q} className="h-full w-full object-cover" />
              </div>
            ))}

            <label className="h-16 w-16 flex items-center justify-center cursor-pointer border rounded">
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleQCUpload} />
              <Upload />
            </label>
          </div>
        </div>

        <button
          onClick={executeQC}
          disabled={qcImages.length === 0 || isRunningQC}
          className={`mt-4 w-full py-2 rounded font-semibold flex items-center justify-center gap-2 ${qcImages.length === 0 || isRunningQC ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-indigo-700'}`}
        >
          {isRunningQC ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Zap size={16} />
              <span>Start Background Analysis</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};