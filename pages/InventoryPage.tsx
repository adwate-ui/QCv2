import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getPublicImageUrl, db } from '../services/db';
import { Product } from '../types';
import { Link } from 'react-router-dom';
import { Plus, Search, Tag, Filter, CheckCircle, XCircle, AlertTriangle, Clock, Trash2, LayoutGrid } from 'lucide-react';

type FilterType = 'ALL' | 'PASS' | 'FAIL' | 'CAUTION' | 'PENDING';

// Normalize category names to group similar products together
const normalizeCategory = (category: string | undefined): string => {
  if (!category) return 'Uncategorized';
  // Normalize: trim, lowercase, preserve hyphens and apostrophes, remove other special chars, normalize spacing
  return category
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s'-]/g, '') // Keep alphanumeric, spaces, hyphens, and apostrophes
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Title case each word
    .join(' ');
};

const GridButton = ({ key, size, isActive, onClick }: { key: number, size: number, isActive: boolean, onClick: () => void }) => {
    const gridTemplates = {
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
        5: 'grid-cols-5',
    };

    return (
        <button
            onClick={onClick}
            className={`p-2 rounded-lg transition-colors ${
                isActive ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
            }`}
        >
            <div className={`grid ${gridTemplates[size]} gap-1 w-5 h-5`}>
                {Array.from({ length: size * size }).map((_, i) => (
                    <div key={i} className="bg-current rounded-sm"></div>
                ))}
            </div>
        </button>
    );
};

export const InventoryPage = () => {
  const { products, user, deleteProduct, bulkDeleteProducts } = useApp();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterType>('ALL');
  const [groupedProducts, setGroupedProducts] = useState<Record<string, Product[]>>({});
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const imageMapRef = useRef<Record<string, string>>({});
  const loadingImagesRef = useRef<Set<string>>(new Set());
  const [gridSize, setGridSize] = useState(() => {
    const savedGridSize = localStorage.getItem('inventoryGridSize');
    return savedGridSize ? parseInt(savedGridSize, 10) : 3;
  });

  const gridColsClass = gridSize === 2 ? "md:grid-cols-2" : 
                      gridSize === 3 ? "md:grid-cols-3" :
                      gridSize === 4 ? "md:grid-cols-4" :
                      gridSize === 5 ? "md:grid-cols-5" : "md:grid-cols-3";

  // Sync ref with state
  useEffect(() => {
    imageMapRef.current = imageMap;
  }, [imageMap]);

  // Helper to convert blob to base64
  const blobToBase64 = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  // Memoized function to load a single image
  const loadImage = useCallback(async (productId: string, imageId: string, userId: string) => {
    // Double-check if already loaded or loading
    if (imageMapRef.current[productId] || loadingImagesRef.current.has(productId)) {
      return null;
    }
    
    // Mark as loading
    loadingImagesRef.current.add(productId);
    
    try {
      // Try db.getImage first
      try {
        const imgBase64 = await db.getImage(imageId);
        if (imgBase64) {
          return imgBase64;
        }
      } catch (e) {
        console.debug('db.getImage failed for', imageId, e);
      }

      // Fallback: try to get a signed URL via the DB service and fetch that
      try {
        const signed = await db.getSignedUrl(imageId, 60);
        if (signed) {
          const resp = await fetch(signed);
          if (resp.ok) {
            const blob = await resp.blob();
            return await blobToBase64(blob);
          }
        }
      } catch (e) {
        console.debug('Signed URL fetch error for', imageId, e);
      }

      // Fallback: try to fetch the public URL and convert to base64 client-side
      const publicUrl = getPublicImageUrl(userId, imageId);
      try {
        const resp = await fetch(publicUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          return await blobToBase64(blob);
        }
      } catch (e) {
        console.debug('Public URL fetch error for', publicUrl, e);
      }
      
      return null;
    } catch (e) {
      console.error('Failed to load thumbnail for', productId, e);
      return null;
    } finally {
      // Clean up loading state
      loadingImagesRef.current.delete(productId);
    }
  }, [blobToBase64]);

  useEffect(() => {
    // 1. Filter Logic
    let filteredList = products.filter(p => 
      p.profile.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.profile.brand.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (statusFilter !== 'ALL') {
      filteredList = filteredList.filter(p => {
        const latestReport = p.reports && p.reports.length > 0 ? p.reports[p.reports.length - 1] : null;
        if (statusFilter === 'PENDING') return !latestReport;
        return latestReport?.overallGrade === statusFilter;
      });
    }

    // 2. Group products by category (normalize to avoid similar categories creating separate sections)
    const grouped = filteredList.reduce((acc, product) => {
      const normalizedCat = normalizeCategory(product.profile.category);
      if (!acc[normalizedCat]) acc[normalizedCat] = [];
      acc[normalizedCat].push(product);
      return acc;
    }, {} as Record<string, Product[]>);
    setGroupedProducts(grouped);

    // 3. Load thumbnails (prefer base64 via DB.getImage to avoid public-bucket/CORS issues)
    if (user?.id) {
      const userId = user.id; // Capture for safe use in async closure
      (async () => {
        const loadPromises = filteredList
          .filter(p => p.referenceImageIds && p.referenceImageIds.length > 0)
          .filter(p => !imageMapRef.current[p.id]) // Check ref to avoid re-loading
          .map(async (p) => {
            const imageId = p.referenceImageIds[0];
            const dataUrl = await loadImage(p.id, imageId, userId);
            return dataUrl ? { [p.id]: dataUrl } : null;
          });

        const results = await Promise.all(loadPromises);
        const newImages = results.filter(Boolean).reduce((acc, img) => ({ ...acc, ...img }), {} as Record<string, string>);
        
        // Only update state if we loaded new images
        if (Object.keys(newImages).length > 0) {
          setImageMap(prev => ({ ...prev, ...newImages }));
        }
      })();
    }
  }, [products, searchTerm, statusFilter, user?.id, loadImage]);

  useEffect(() => {
    localStorage.setItem('inventoryGridSize', gridSize.toString());
  }, [gridSize]);

  if (!user?.apiKey) {
    return (
      <div className="text-center mt-20 p-6">
        <h2 className="text-2xl font-bold mb-4">API Key Required</h2>
        <p className="text-slate-500 mb-6">Please set your Gemini API key in your profile to start using the app.</p>
        <Link to="/user" className="bg-primary text-white px-6 py-2 rounded-lg">Go to Profile</Link>
      </div>
    );
  }

  const FilterButton = ({ type, label, icon: Icon, activeClass }: { type: FilterType, label: string, icon?: React.ElementType, activeClass: string }) => (
    <button
      onClick={() => setStatusFilter(type)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all border ${
        statusFilter === type ? activeClass : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 text-xs md:text-sm">Manage your authentic product profiles</p>
        </div>
        <Link to="/inventory/new" className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 md:py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm w-full md:w-fit">
          <Plus size={18} /> Add Product
        </Link>
      </div>

      <div className="space-y-2 md:space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 md:py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-base md:text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-gray-400 flex items-center gap-1 mr-1 text-xs md:text-sm shrink-0"><Filter size={14} /> Filter:</span>
          <FilterButton type="ALL" label="All" activeClass="bg-gray-800 text-white border-gray-800" />
          <FilterButton type="PASS" label="Passed" icon={CheckCircle} activeClass="bg-green-100 text-green-800 border-green-200" />
          <FilterButton type="FAIL" label="Failed" icon={XCircle} activeClass="bg-red-100 text-red-800 border-red-200" />
          <FilterButton type="CAUTION" label="Caution" icon={AlertTriangle} activeClass="bg-yellow-100 text-yellow-800 border-yellow-200" />
          <FilterButton type="PENDING" label="Pending" icon={Clock} activeClass="bg-blue-50 text-blue-600 border-blue-200" />
        
          <div className="hidden md:flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-500">View:</span>
            <div className="flex items-center gap-2">
                {[2, 3, 4, 5].map((size) => (
                    <GridButton
                        key={size}
                        size={size}
                        isActive={gridSize === size}
                        onClick={() => setGridSize(size)}
                    />
                ))}
            </div>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-4 bg-white border rounded-xl p-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold">{selectedIds.length} selected</div>
            <button
              onClick={async () => {
                if (!confirm(`Delete ${selectedIds.length} selected products? This cannot be undone.`)) return;
                  await bulkDeleteProducts(selectedIds);
                setSelectedIds([]);
              }}
              className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm"
            >
              <Trash2 size={14} /> Delete selected
            </button>
            <button onClick={() => setSelectedIds([])} className="text-sm text-gray-600 px-2">Clear</button>
          </div>
        </div>
      )}

      {Object.keys(groupedProducts).length === 0 ? (
        <div className="text-center py-12 md:py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <p className="text-slate-400 text-sm md:text-base">No products found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-6 md:space-y-8">
          {Object.entries(groupedProducts).map(([category, prods]: [string, Product[]]) => (
            <div key={category}>
              <h3 className="flex items-center gap-2 text-base md:text-lg font-bold text-slate-800 mb-3 md:mb-4 bg-gray-100 p-2 rounded-lg inline-block px-3 md:px-4">
                <Tag size={16} /> {category}
              </h3>
              <div className={`grid grid-cols-2 ${gridColsClass} gap-3 md:gap-4`}>
                {prods.map(product => {
                  const latestReport = product.reports && product.reports.length > 0 ? product.reports[product.reports.length - 1] : null;
                  
                  const isSelected = selectedIds.includes(product.id);
                  let statusClass = 'bg-yellow-400 text-slate-900';
                  if (latestReport) {
                    if (latestReport.overallGrade === 'PASS') statusClass = 'bg-green-500 text-white';
                    else if (latestReport.overallGrade === 'FAIL') statusClass = 'bg-red-500 text-white';
                    else statusClass = 'bg-yellow-400 text-slate-900';
                  }

                  return (
                    <div key={product.id} className={`group bg-white rounded-lg md:rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden relative ${isSelected ? 'ring-2 ring-primary/40' : ''}`}>
                      <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                        {imageMap[product.id] ? (
                          <img src={imageMap[product.id]} alt={product.profile.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                            <Tag size={20} className="md:w-6 md:h-6" />
                          </div>
                        )}

                        {/* Status Badge */}
                        <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 shadow-sm">
                          {latestReport ? (
                            <div className={"px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[9px] md:text-[10px] font-bold uppercase " + statusClass}>
                              {latestReport.overallGrade}
                            </div>
                          ) : (
                            <div className="px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[9px] md:text-[10px] font-bold uppercase bg-gray-600 text-white flex items-center gap-0.5 md:gap-1">
                               <Clock size={8} className="md:w-2.5 md:h-2.5" /> Pending
                            </div>
                          )}
                        </div>
                      </div>
                      <Link to={'/inventory/' + product.id} className="block">
                        <div className="p-2.5 md:p-4">
                          <p className="text-[10px] md:text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5 md:mb-1 truncate">{product.profile.brand || 'Unknown'}</p>
                          <h4 className="font-bold text-xs md:text-base text-slate-900 truncate">{product.profile.name || product.profile.url || 'Untitled Product'}</h4>
                          <p className="text-xs md:text-sm text-slate-600 mt-0.5 md:mt-1 truncate">{product.profile.priceEstimate || ''}</p>
                        </div>
                      </Link>

                      {/* Controls overlay: checkbox & delete (stop propagation/prevent navigation) */}
                      <div className="absolute top-2 left-2 md:top-3 md:left-3 z-20">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) setSelectedIds(prev => [...prev, product.id]);
                            else setSelectedIds(prev => prev.filter(id => id !== product.id));
                          }}
                          onClick={e => e.stopPropagation()}
                          className="w-3.5 h-3.5 md:w-4 md:h-4 cursor-pointer"
                        />
                      </div>

                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          // prevent Link navigation
                          e.preventDefault?.();
                          if (!confirm('Delete product "' + product.profile.name + '"? This cannot be undone.')) return;
                          await deleteProduct(product.id);
                          setSelectedIds(prev => prev.filter(id => id !== product.id));
                        }}
                        className="absolute bottom-2 right-2 md:bottom-3 md:right-3 z-20 bg-white rounded-full p-1 shadow-sm hover:bg-red-50"
                        title="Delete product"
                      >
                        <Trash2 size={14} className="md:w-4 md:h-4 text-red-600" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};