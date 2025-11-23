import React, { useState } from 'react';
import { signIn, signUp, signInWithGoogle } from '../services/supabaseService';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';

interface Props {
  onAuthSuccess: () => void;
}

export const AuthForm: React.FC<Props> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { user, error } = await signIn(email, password);
        if (error) throw error;
        if (user) onAuthSuccess();
      } else {
        const { user, error, session } = await signUp(email, password) as any; // Cast for session property access if type def varies
        if (error) throw error;
        
        if (user) {
           if (!session) {
             // Email confirmation is required by Supabase default settings
             setMessage(`Account created! Please check your email (${email}) to confirm your account before signing in.`);
             setIsLogin(true); // Switch back to login mode so they are ready
           } else {
             // If auto-confirm is on (rare for prod), we log them in
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

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 w-full">
      <h3 className="text-xl font-bold text-slate-900 mb-2">
        {isLogin ? 'Sign In to Save' : 'Create Account'}
      </h3>
      <p className="text-slate-500 text-sm mb-6">
        {isLogin ? 'Access your past measurements.' : 'Save your results and 3D models forever.'}
      </p>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 font-medium flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>{error}</div>}
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
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="you@example.com"
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
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
        >
          {loading ? 'Processing...' : (isLogin ? <><LogIn size={18}/> Sign In</> : <><UserPlus size={18}/> Sign Up</>)}
        </button>
      </form>
      
      <div className="mt-4 pt-4 border-t border-slate-100 text-center">
        <button 
          onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
          className="text-sm text-blue-600 hover:underline font-medium"
        >
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
        </button>
      </div>
      
      <div className="mt-4">
          <button 
            onClick={signInWithGoogle}
            className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
             <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.82-.15-1.82Z"/></svg>
             Continue with Google
          </button>
      </div>
    </div>
  );
};