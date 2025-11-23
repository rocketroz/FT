
import React, { useState, useEffect } from 'react';
import { X, Save, Database, CheckCircle, AlertCircle, Shield, Cpu, Activity } from 'lucide-react';
import { configureSupabase, isSupabaseConnected } from '../services/supabaseService';
import { AppStep } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToAdmin?: () => void;
  currentModel: string;
  onModelChange: (model: string) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, onNavigateToAdmin, currentModel, onModelChange }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [connected, setConnected] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Local state for the model to allow immediate feedback before saving/closing
  const [selectedModel, setSelectedModel] = useState(currentModel);

  useEffect(() => {
    if (isOpen) {
      setConnected(isSupabaseConnected());
      const stored = localStorage.getItem('fit_twin_supabase_config');
      if (stored) {
        const config = JSON.parse(stored);
        setUrl(config.url || '');
        setKey(config.key || '');
      }
      setSelectedModel(currentModel);
    }
  }, [isOpen, currentModel]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const success = configureSupabase(url, key);
    setConnected(success);
    
    // Commit model change
    onModelChange(selectedModel);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 p-4 flex justify-between items-center">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Cpu size={18} className="text-blue-400" /> Settings
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6">
          
          {/* AI Model Selection Section */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity size={14} /> AI Model Strategy
            </h4>
            
            <div className="grid grid-cols-1 gap-3">
               <label className={`
                  relative flex items-center p-4 border rounded-xl cursor-pointer transition-all
                  ${selectedModel === 'gemini-3-pro-preview' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}
               `}>
                  <input 
                    type="radio" 
                    name="model" 
                    value="gemini-3-pro-preview" 
                    checked={selectedModel === 'gemini-3-pro-preview'}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="absolute opacity-0"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">Gemini 3.0 Pro</span>
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">DEFAULT</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Native multimodal reasoning. Best for complex visual analysis.</p>
                  </div>
                  {selectedModel === 'gemini-3-pro-preview' && <CheckCircle size={18} className="text-blue-600 ml-3" />}
               </label>

               <label className={`
                  relative flex items-center p-4 border rounded-xl cursor-pointer transition-all
                  ${selectedModel === 'gemini-2.5-flash' ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500' : 'border-slate-200 hover:border-slate-300'}
               `}>
                  <input 
                    type="radio" 
                    name="model" 
                    value="gemini-2.5-flash" 
                    checked={selectedModel === 'gemini-2.5-flash'}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="absolute opacity-0"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">Gemini 2.5 Flash</span>
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">THINKING MODE</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Uses "Thinking Config" (12k budget) for deep logical chains.</p>
                  </div>
                   {selectedModel === 'gemini-2.5-flash' && <CheckCircle size={18} className="text-amber-600 ml-3" />}
               </label>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Database Section */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
               <Database size={14} /> Cloud Database
            </h4>
            
            <div className={`p-3 rounded-lg flex items-start gap-3 text-sm mb-4 ${connected ? 'bg-green-50 text-green-800' : 'bg-slate-50 text-slate-600'}`}>
              {connected ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
              <div>
                <span className="font-bold block">{connected ? 'Connected to Supabase' : 'Not Connected'}</span>
                <p className="text-xs opacity-80 mt-1">
                  {connected 
                    ? 'Cloud saving enabled.' 
                    : 'Enter details to enable cloud saving.'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Project URL</label>
                <input 
                  type="text" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xyz.supabase.co"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-mono text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Anon Key</label>
                <input 
                  type="password" 
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="eyJh..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-mono text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <button 
              type="submit"
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${saved ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              {saved ? <CheckCircle size={18} /> : <Save size={18} />}
              {saved ? 'Changes Saved' : 'Save Configuration'}
            </button>
            
            {connected && onNavigateToAdmin && (
              <button
                type="button"
                onClick={() => { onClose(); onNavigateToAdmin(); }}
                className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                <Shield size={18} /> Open Admin Dashboard
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
