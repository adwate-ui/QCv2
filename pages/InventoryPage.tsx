import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { db } from '../services/db';
import { Product } from '../types';
import { Link } from 'react-router-dom';
import { Plus, Search, Tag, Filter, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';

type FilterType = 'ALL' | 'PASS' | 'FAIL' | 'CAUTION' | 'PENDING';

export const InventoryPage = () => {
  const { products, user } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterType>('ALL');
  const [groupedProducts, setGroupedProducts] = useState<Record<string, Product[]>>({});
  const [imageMap, setImageMap] = useState<Record<string, string>>({});

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

    // 2. Group products by category
    const grouped = filteredList.reduce((acc, product) => {
      const cat = product.profile.category || 'Uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(product);
      return acc;
    }, {} as Record<string, Product[]>);
    setGroupedProducts(grouped);

    // 3. Load thumbnails
    const loadImages = async () => {
      const map: Record<string, string> = {};
      for (const p of filteredList) {
        if (p.referenceImageIds.length > 0) {
          if (!imageMap[p.id]) {
             const img = await db.getImage(p.referenceImageIds[0]);
             if (img) map[p.id] = img;
          } else {
             map[p.id] = imageMap[p.id];
          }
        }
      }
      setImageMap(prev => ({...prev, ...map}));
    };
    loadImages();
  }, [products, searchTerm, statusFilter]);

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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 text-sm">Manage your authentic product profiles</p>
        </div>
        <Link to="/inventory/new" className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm w-fit">
          <Plus size={18} /> Add Product
        </Link>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-gray-400 flex items-center gap-1 mr-1 text-sm"><Filter size={14} /> Filter:</span>
          <FilterButton type="ALL" label="All" activeClass="bg-gray-800 text-white border-gray-800" />
          <FilterButton type="PASS" label="Passed" icon={CheckCircle} activeClass="bg-green-100 text-green-800 border-green-200" />
          <FilterButton type="FAIL" label="Failed" icon={XCircle} activeClass="bg-red-100 text-red-800 border-red-200" />
          <FilterButton type="CAUTION" label="Caution" icon={AlertTriangle} activeClass="bg-yellow-100 text-yellow-800 border-yellow-200" />
          <FilterButton type="PENDING" label="Pending" icon={Clock} activeClass="bg-blue-50 text-blue-600 border-blue-200" />
        </div>
      </div>

      {Object.keys(groupedProducts).length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <p className="text-slate-400">No products found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedProducts).map(([category, prods]: [string, Product[]]) => (
            <div key={category}>
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-4 bg-gray-100 p-2 rounded-lg inline-block px-4">
                <Tag size={16} /> {category}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {prods.map(product => {
                  const latestReport = product.reports && product.reports.length > 0 ? product.reports[product.reports.length - 1] : null;
                  
                  return (
                    <Link to={`/inventory/${product.id}`} key={product.id} className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden relative">
                      <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                        {imageMap[product.id] ? (
                          <img src={imageMap[product.id]} alt={product.profile.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400 text-sm">No Image</div>
                        )}
                        
                        {/* Status Badge */}
                        <div className="absolute top-2 right-2 shadow-sm">
                          {latestReport ? (
                            <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                              latestReport.overallGrade === 'PASS' ? 'bg-green-500 text-white' : 
                              latestReport.overallGrade === 'FAIL' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-slate-900'
                            }`}>
                              {latestReport.overallGrade}
                            </div>
                          ) : (
                            <div className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-gray-600 text-white flex items-center gap-1">
                               <Clock size={10} /> Pending QC
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">{product.profile.brand}</p>
                        <h4 className="font-bold text-slate-900 truncate">{product.profile.name}</h4>
                        <p className="text-sm text-slate-600 mt-1">{product.profile.priceEstimate}</p>
                      </div>
                    </Link>
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