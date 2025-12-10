import React, { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthPage } from './pages/AuthPage';
import { isSupabaseConfigured, saveSupabaseConfig } from './services/supabase';
import { logEnvValidation } from './services/env';
import { Database, ArrowRight, AlertCircle } from 'lucide-react';
import { Input } from './components/Input';

// Validate environment on app initialization
logEnvValidation();

// Lazy load pages for better performance
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage').then(m => ({ default: m.ProductDetailPage })));
const AddProductPage = lazy(() => import('./pages/AddProductPage').then(m => ({ default: m.AddProductPage })));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const QCInspectionDemo = lazy(() => import('./pages/QCInspectionDemo').then(m => ({ default: m.QCInspectionDemo })));

// Loading fallback component
const PageLoader = () => (
  <div className="h-screen flex items-center justify-center bg-slate-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
      <div className="text-slate-400">Loading...</div>
    </div>
  </div>
);

const SetupPage = () => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.startsWith('http')) {
      setError('URL must start with http:// or https://');
      return;
    }
    if (!key) {
      setError('API Key is required');
      return;
    }
    saveSupabaseConfig(url, key);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className="bg-green-100 p-4 rounded-full text-green-700">
            <Database size={48} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Connect to Supabase</h1>
        <p className="text-center text-slate-500 mb-6">
          Please enter your Supabase Project details to connect the database.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
          <p className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              You can find these in your Supabase Dashboard under <strong>Project Settings &gt; API</strong>.
            </span>
          </p>
        </div>

        <form onSubmit={handleSave}>
          <Input 
            label="Project URL" 
            placeholder="https://your-project.supabase.co"
            value={url}
            onChange={e => setUrl(e.target.value)}
            required
          />
          <Input 
            label="API Key (public/anon)" 
            type="password"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic2drdm1qdHNqcG1qcnB1cG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTQ4MjQsImV4cCI6MjA4MDY3MDgyNH0.GYsoEO8qJXOsiOjK2QHYMOOI0OFAdc9KqX1SA-Z-3ac"
            value={key}
            onChange={e => setKey(e.target.value)}
            required
          />
          
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <button 
            type="submit" 
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-2"
          >
            Connect & Continue <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, loading } = useApp();
  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-slate-400">Loading AuthentiQC...</div></div>;
  if (!user) return <AuthPage />;
  return <Layout>{children}</Layout>;
};

const AppContent = () => {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/inventory" replace />} />
          
          <Route path="/inventory" element={
            <ProtectedRoute>
              <InventoryPage />
            </ProtectedRoute>
          } />
          
          <Route path="/inventory/new" element={
            <ProtectedRoute>
              <AddProductPage />
            </ProtectedRoute>
          } />
          
          <Route path="/inventory/:id" element={
            <ProtectedRoute>
              <ProductDetailPage />
            </ProtectedRoute>
          } />
          
          <Route path="/user" element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          } />
          
          <Route path="/qc-demo" element={<QCInspectionDemo />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default function App() {
  if (!isSupabaseConfigured()) {
    return <SetupPage />;
  }

  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}