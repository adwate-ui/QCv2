import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Input } from '../components/Input';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AuthPage = () => {
  const { login, register } = useApp();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    let result = { success: false, message: '' };
    
    if (isLogin) {
      result = await login(email, password) as any; // Cast to any to handle the updated return signature if TS complains, or assume AppContext is updated
    } else {
      result = await register(email, password) as any;
    }

    if (result.success) {
      // Redirect to inventory immediately on success
      navigate('/inventory');
    } else {
      setError(result.message || (isLogin ? "Invalid credentials" : "User already registered"));
      // If registration failed because user exists but success was false, check if we should swap to login
      if (!isLogin && result.message?.includes("already registered")) {
        // Optional: could auto-switch to login
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-xl md:rounded-2xl shadow-xl p-6 md:p-8">
        <div className="flex justify-center mb-4 md:mb-6">
          <div className="bg-primary/10 p-3 md:p-4 rounded-full">
            <ShieldCheck size={40} className="md:w-12 md:h-12 text-primary" />
          </div>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-center text-slate-800 mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-center text-slate-500 text-sm md:text-base mb-6 md:mb-8">
          {isLogin ? 'Sign in to access your inventory' : 'Start your QC journey today'}
        </p>

        <form onSubmit={handleSubmit}>
          <Input 
            label="Email Address" 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            placeholder="you@example.com"
          />
          <Input 
            label="Password" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            placeholder="••••••••"
          />
          
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <button 
            type="submit" 
            className="w-full bg-primary text-white font-bold py-3 md:py-3.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 text-base md:text-lg"
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button"
            onClick={() => {
                setIsLogin(!isLogin);
                setError('');
            }}
            className="text-sm md:text-base text-slate-500 hover:text-primary transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};