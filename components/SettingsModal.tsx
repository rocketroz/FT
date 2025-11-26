import React, { useState, useEffect } from 'react';
import { X, Save, Database, CheckCircle, Shield, Cpu, Activity } from 'lucide-react';
import { configureSupabase, isSupabaseConnected, getSupabaseConfig } from '../services/supabaseService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToAdmin?: () => void;
  currentModel: string;
  onModelChange: (model: string) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, onNavigateToAdmin, currentModel, onModelChange }) => {
  if (!isOpen) return null;

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setIsConnected(isSupabaseConnected());
    const config = getSupabaseConfig();
    setSupabaseUrl(config.url);
    setSupabaseKey(config.key);
  }, [isOpen]);

  const handleSaveSupabase = () => {
    const success = configureSupabase(supabaseUrl, supabaseKey);
    if (success) {
      setIsConnected(true);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="text-blue-600" /> Settings
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* AI Model Selection */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Cpu size={16} /> AI Model Configuration
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => onModelChange('gemini-3-pro-preview')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  currentModel === 'gemini-3-pro-preview' 
                    ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' 
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-slate-900">Gemini 3 Pro</span>
                  {currentModel === 'gemini-3-pro-preview' && <CheckCircle size={16} className="text-blue-600" />}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Best for complex reasoning, detailed analysis, and fit advice. Slower but more accurate.
                </p>
              </button>

              <button 
                onClick={() => onModelChange('gemini-2.5-flash')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  currentModel === 'gemini-2.5-flash' 
                    ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' 
                    : 'border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-slate-900">Gemini 2.5 Flash</span>
                  {currentModel === 'gemini-2.5-flash' && <CheckCircle size={16} className="text-amber-600" />}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  High speed, lower latency. Uses <b>Thinking Config</b> for enhanced reasoning. Good for quick scans.
                </p>
              </button>
            </div>
          </section>

          {/* Database Configuration */}
          <section className="bg-slate-50 p-6 rounded-xl border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Database size={16} /> Supabase Connection
              </h3>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                isConnected ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
              }`}>
                {isConnected ? <><CheckCircle size={12} /> Connected</> : 'Disconnected'}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Project URL</label>
                <input 
                  type="text" 
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Anon / Public Key</label>
                <input 
                  type="password" 
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJh..."
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                 <button 
                   onClick={handleSaveSupabase}
                   className={`px-4 py-2 rounded-lg font-bold text-sm text-white flex items-center gap-2 transition-all ${
                     saveStatus === 'success' ? 'bg-green-600' : 
                     saveStatus === 'error' ? 'bg-red-600' : 
                     'bg-slate-900 hover:bg-slate-800'
                   }`}
                 >
                   {saveStatus === 'success' ? <CheckCircle size={16} /> : <Save size={16} />}
                   {saveStatus === 'success' ? 'Saved' : 'Connect'}
                 </button>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 mt-4 flex items-center gap-1">
              <Shield size={10} /> Credentials are stored locally in your browser.
            </p>
          </section>

          {/* Admin Tools */}
          {onNavigateToAdmin && (
            <section className="pt-4 border-t border-slate-100">
              <button 
                onClick={onNavigateToAdmin}
                className="text-slate-500 hover:text-blue-600 text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <Shield size={16} /> Open Admin Dashboard
              </button>
            </section>
          )}

          <div className="text-center text-xs text-slate-400 pt-8">
            Fit Twin v2.4 • Gemini Schema 2025
          </div>
        </div>
      </div>
    </div>
  );
};