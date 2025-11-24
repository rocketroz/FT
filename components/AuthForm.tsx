import React, { useState, useEffect } from 'react';
import { signIn, signUp, signInWithGoogle, isSupabaseConnected, onSupabaseConnectionChange, initSupabase } from '../services/supabaseService';
import { Mail, Lock, LogIn, UserPlus, AlertTriangle, Settings, RefreshCw, Plug } from 'lucide-react';

interface Props {
  onAuthSuccess: () => void;
  onOpenSettings?: () => void;
}

export const AuthForm: React.FC<Props> = ({ onAuthSuccess, onOpenSettings }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  // Initialize with current state to avoid flicker
  const [isConnected, setIsConnected] = useState(() => isSupabaseConnected());

  useEffect(() => {
    // Subscribe to updates. callback fires immediately with current status.
    const unsubscribe = onSupabaseConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) setError(null);
    });

    // Try to init if not connected on mount
    if (!isSupabaseConnected()) {
      initSupabase();
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRetry = () => {
    const connected = initSupabase();
    setIsConnected(connected);
    if (!connected) {
      setError("Still disconnected. Please check connection settings.");
    } else {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!isConnected && !initSupabase()) {
        throw new Error("Database not connected. Please configure settings.");
      }

      if (isLogin) {
        const { user, error } = await signIn(email, password);
        if (error) throw error;
        if (user) onAuthSuccess();
      } else {
        const { user, error, session } = await signUp(email, password);
        if (error) throw error;
        
        if (user) {
           if (!session) {
             setMessage(`Account created! Please check your email (${email}) to confirm your account before signing in.`);
             setIsLogin(true); 
           } else {
             setMessage("Account created successfully!");
             onAuthSuccess();
           }
        }
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    
    if (!initSupabase()) {
      setError("Database Disconnected. Please configure Settings.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(error.message);
      }
    } catch (e: any) {
      setError(e.message || "Google Sign In failed");
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 w-full animate-fade-in">
      <h3 className="text-xl font-bold text-slate-900 mb-2">
        {isLogin ? 'Sign In to Save' : 'Create Account'}
      </h3>
      <p className="text-slate-500 text-sm mb-6">
        {isLogin ? 'Access your past measurements.' : 'Save your results and 3D models forever.'}
      </p>

      {!isConnected && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-lg text-sm mb-4 border border-amber-200 flex flex-col gap-3 animate-pulse-slow">
           <div className="flex items-center gap-2 font-bold">
             <AlertTriangle size={16} />
             <span>Database Not Connected</span>
           </div>
           <div className="text-amber-700/80 text-xs leading-relaxed">
             The app requires a Supabase connection to save results. You can connect securely in Settings.
           </div>
           
           <div className="flex gap-2">
             <button 
               type="button"
               onClick={handleRetry} 
               className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
             >
               <RefreshCw size={12} /> Retry
             </button>
             {onOpenSettings && (
               <button 
                 type="button"
                 onClick={onOpenSettings} 
                 className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
               >
                 <Plug size={14} /> Connect Database
               </button>
             )}
           </div>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 font-medium flex items-center gap-2 border border-red-100"><div className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></div>{error}</div>}
      {message && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4 font-medium border border-green-200">{message}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-slate-100"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-slate-100"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading || !isConnected}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
        >
          {loading ? 'Processing...' : (isLogin ? <><LogIn size={18}/> Sign In</> : <><UserPlus size={18}/> Sign Up</>)}
        </button>
      </form>
      
      <div className="mt-4 pt-4 border-t border-slate-100 text-center">
        <button 
          type="button"
          onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
          className="text-sm text-blue-600 hover:underline font-medium"
        >
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
        </button>
      </div>
      
      <div className="mt-4">
          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={!isConnected || loading}
            className="w-full border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-slate-700 font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
             <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.82-.15-1.82Z"/></svg>
             Continue with Google
          </button>
      </div>
    </div>
  );
};