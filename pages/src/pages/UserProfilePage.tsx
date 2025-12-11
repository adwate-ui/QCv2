import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Key, User as UserIcon, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react';

export const UserProfilePage = () => {
  const { user, updateApiKey, deleteAccount } = useApp();
  const [apiKey, setApiKey] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [msg, setMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // If user has no key, default to edit mode
    if (user && !user.apiKey) {
      setIsEditingKey(true);
    }
  }, [user]);

  const handleSaveKey = async () => {
    setIsSaving(true);
    try {
        await updateApiKey(apiKey);
        setIsEditingKey(false);
        setMsg('API Key updated successfully!');
        setApiKey(''); // Clear local state for security
        setTimeout(() => setMsg(''), 3000);
    } catch (error: any) {
        console.error(error);
        alert(`Failed to save API Key: ${error.message || "Unknown error"}. Check console for details.`);
    } finally {
        setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingKey(false);
    setApiKey('');
  };

  const handleDeleteAccount = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone and you will lose your profile settings.")) {
      setIsDeleting(true);
      try {
        await deleteAccount();
        // No need to set isDeleting false here as we expect a redirect/reload
      } catch (error: any) {
        alert("Account deletion encountered an issue: " + error.message);
        setIsDeleting(false);
      }
    }
  };

  // Mask the key for display: "AIza...1234"
  const getMaskedKey = (key: string) => {
    if (key.length < 8) return "********";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">User Profile</h1>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-gray-100 p-3 rounded-full shrink-0"><UserIcon size={32} className="text-gray-600"/></div>
          <div className="min-w-0">
              <p className="text-sm text-gray-500">Logged in as</p>
              <p className="font-bold text-lg truncate">{user?.email}</p>
          </div>
      </div>

      {/* API Key Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-100 p-2 rounded-lg text-yellow-700 shrink-0"><Key size={24} /></div>
            <h2 className="font-bold text-lg">Gemini API Configuration</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">Your API key is stored securely in your private profile.</p>
        
        {isEditingKey ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <input 
                type="password" 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-base"
                placeholder="Enter your Gemini API Key"
                autoFocus
            />
            <div className="flex flex-col md:flex-row gap-2">
              <button 
                onClick={handleSaveKey} 
                disabled={!apiKey || isSaving}
                className="w-full md:w-auto bg-primary text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : <><Check size={16} /> Save Key</>}
              </button>
              {user?.apiKey && (
                <button 
                  onClick={handleCancelEdit} 
                  disabled={isSaving}
                  className="w-full md:w-auto bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-200 flex items-center justify-center gap-2"
                >
                  <X size={16} /> Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 uppercase font-semibold mb-1">Current Key</span>
              <code className="font-mono text-sm text-slate-700 font-bold tracking-wider break-all">
                {user?.apiKey ? getMaskedKey(user.apiKey) : "No API Key Set"}
              </code>
            </div>
            <button 
              onClick={() => setIsEditingKey(true)} 
              className="w-full md:w-auto text-primary hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Edit2 size={16} /> Change
            </button>
          </div>
        )}

        {msg && <p className="text-green-600 text-sm mt-4 flex items-center gap-2"><Check size={14} /> {msg}</p>}

        <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2">Need a key?</p>
            <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1 font-medium"
            >
                Get a free API key from Google AI Studio
            </a>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-100">
        <h3 className="text-red-800 font-bold text-lg mb-2">Danger Zone</h3>
        <p className="text-red-600/80 text-sm mb-6">Permanently remove your account and access data from this device.</p>
        
        <button 
          type="button"
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          className="bg-white border border-red-200 text-red-600 px-6 py-2.5 rounded-lg font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center gap-2 w-full md:w-auto justify-center disabled:opacity-70 disabled:cursor-wait"
        >
          {isDeleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
          {isDeleting ? 'Deleting...' : 'Delete Account'}
        </button>
      </div>
    </div>
  );
};