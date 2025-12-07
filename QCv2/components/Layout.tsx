import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, PlusSquare, User as UserIcon, LogOut, Zap, Brain, Bell, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { ModelTier, ExpertMode } from '../types';

export const Layout = ({ children }: { children?: React.ReactNode }) => {
  const { user, settings, tasks, toggleModelTier, toggleExpertMode, logout, dismissTask } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [showTasks, setShowTasks] = useState(false);

  if (!user) return <div className="min-h-screen bg-gray-50 flex flex-col">{children}</div>;

  const isActive = (path: string) => location.pathname === path ? "text-primary" : "text-slate-400";
  
  const activeTasks = tasks.filter(t => t.status === 'PROCESSING');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'FAILED');

  const handleTaskClick = (task: any) => {
    if (task.status !== 'COMPLETED') return;
    
    if (task.type === 'IDENTIFY') {
        // Navigate to add product page with task ID to hydrate state
        navigate(`/inventory/new?reviewTaskId=${task.id}`);
        setShowTasks(false);
    } else if (task.type === 'QC') {
        navigate(`/inventory/${task.meta.targetId}`);
        setShowTasks(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 pb-20 md:pb-0 h-screen">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
        <Link to="/inventory" className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          AuthentiQC
        </Link>
        
        <div className="flex items-center gap-2">
          {/* Activity Center */}
          <div className="relative">
             <button 
                onClick={() => setShowTasks(!showTasks)}
                className="p-2 rounded-lg hover:bg-gray-100 relative text-gray-600 transition-colors"
             >
                <Bell size={20} />
                {activeTasks.length > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-blue-500 rounded-full border border-white animate-pulse"></span>
                )}
                {completedTasks.length > 0 && activeTasks.length === 0 && (
                     <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-green-500 rounded-full border border-white"></span>
                )}
             </button>

             {showTasks && (
                 <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowTasks(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-sm text-gray-700">Activity Center</h3>
                            <span className="text-xs text-gray-400">{tasks.length} tasks</span>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {tasks.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">No recent activity</div>
                            ) : (
                                tasks.map(task => (
                                    <div key={task.id} className="p-3 border-b border-gray-100 hover:bg-gray-50 flex gap-3 relative group">
                                        <div className="mt-1">
                                            {task.status === 'PROCESSING' && <Loader2 size={16} className="text-blue-500 animate-spin" />}
                                            {task.status === 'COMPLETED' && <CheckCircle size={16} className="text-green-500" />}
                                            {task.status === 'FAILED' && <AlertTriangle size={16} className="text-red-500" />}
                                        </div>
                                        <div 
                                            className={`flex-1 ${task.status === 'COMPLETED' ? 'cursor-pointer' : ''}`}
                                            onClick={() => handleTaskClick(task)}
                                        >
                                            <p className="text-sm font-medium text-gray-800">{task.meta.title}</p>
                                            <p className="text-xs text-gray-500 truncate">{task.meta.subtitle || (task.status === 'PROCESSING' ? 'Processing in background...' : task.status)}</p>
                                            {task.error && <p className="text-xs text-red-500 mt-1">{task.error}</p>}
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); dismissTask(task.id); }}
                                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                 </>
             )}
          </div>

          <div className="h-6 w-px bg-gray-200 mx-1"></div>

          <button 
            onClick={toggleModelTier}
            className={`p-2 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all ${settings.modelTier === ModelTier.DETAILED ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-green-100 text-green-700 border-green-300'}`}
          >
            <Zap size={14} />
            {settings.modelTier === ModelTier.DETAILED ? 'Pro 3.0' : 'Flash 2.5'}
          </button>
          
          <button 
            onClick={toggleExpertMode}
            className={`p-2 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all ${settings.expertMode === ExpertMode.EXPERT ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-gray-100 text-gray-600 border-gray-300'}`}
          >
            <Brain size={14} />
            {settings.expertMode === ExpertMode.EXPERT ? 'Expert' : 'Normal'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 w-full md:ml-64">
        <div className="max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Desktop Sidebar (Hidden on Mobile) */}
      <nav className="hidden md:flex fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 flex-col p-4 z-40">
        <div className="space-y-2">
          <Link to="/inventory" className={`flex items-center gap-3 p-3 rounded-xl font-medium ${location.pathname === '/inventory' ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-gray-50'}`}>
            <Home size={20} /> Inventory
          </Link>
          <Link to="/inventory/new" className={`flex items-center gap-3 p-3 rounded-xl font-medium ${location.pathname === '/inventory/new' ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-gray-50'}`}>
            <PlusSquare size={20} /> Add Product
          </Link>
          <Link to="/user" className={`flex items-center gap-3 p-3 rounded-xl font-medium ${location.pathname === '/user' ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-gray-50'}`}>
            <UserIcon size={20} /> Profile
          </Link>
        </div>
        <div className="mt-auto">
           <button onClick={logout} className="flex items-center gap-3 p-3 rounded-xl font-medium text-red-500 hover:bg-red-50 w-full text-left">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link to="/inventory" className={`flex flex-col items-center gap-1 ${isActive('/inventory')}`}>
          <Home size={24} />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link to="/inventory/new" className={`flex flex-col items-center gap-1 ${isActive('/inventory/new')}`}>
          <PlusSquare size={24} />
          <span className="text-[10px] font-medium">Add</span>
        </Link>
        <Link to="/user" className={`flex flex-col items-center gap-1 ${isActive('/user')}`}>
          <UserIcon size={24} />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </nav>
    </div>
  );
};