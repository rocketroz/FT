import React, { useState, useEffect } from 'react';
import { X, Save, Database, CheckCircle, AlertCircle, Shield, Cpu, Activity, Code, Copy, ExternalLink } from 'lucide-react';
import { configureSupabase, isSupabaseConnected } from '../services/supabaseService';

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
  const [showSchema, setShowSchema] = useState(false);
  const [copied, setCopied] = useState(false);
  
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const schemaSQL = `
-- 1. Create Tables (Idempotent)
create table if not exists public.measurements (
  id uuid primary key,
  user_id uuid, -- references auth.users(id) if using auth
  created_at timestamptz default now(),
  
  -- Core Fields
  height numeric,
  weight numeric,
  gender text,
  age numeric,
  
  -- Measurements
  chest numeric,
  waist numeric,
  hips numeric,
  shoulder numeric,
  neck numeric,
  sleeve numeric,
  bicep numeric,
  wrist numeric,
  inseam numeric,
  outseam numeric,
  thigh numeric,
  calf numeric,
  ankle numeric,
  torso_length numeric,
  
  -- Metadata & Transparency
  confidence numeric,
  model_name text,
  scaling_factor numeric,
  estimated_height_cm numeric,
  capture_method text,
  
  -- Full Backup (CRITICAL for Fallback Save)
  full_json jsonb,
  landmarks_json jsonb,
  
  -- Usage
  token_count numeric,
  thinking_tokens numeric,
  api_cost_usd numeric,
  thought_summary text
);

create table if not exists public.measurement_images (
  id uuid default gen_random_uuid() primary key,
  measurement_id uuid references public.measurements(id),
  view_type text,
  public_url text,
  storage_path text,
  created_at timestamptz default now()
);

create table if not exists public.measurement_calculations (
  id uuid default gen_random_uuid() primary key,
  measurement_id uuid references public.measurements(id),
  metric_name text,
  raw_pixels text,
  scaling_factor numeric,
  formula text,
  created_at timestamptz default now()
);

-- DEBUG LOGS TABLE (New for Remote Tailing)
create table if not exists public.debug_logs (
  id uuid default gen_random_uuid() primary key,
  session_id text,
  level text, -- 'info', 'warn', 'error'
  message text,
  data jsonb,
  device_info jsonb,
  created_at timestamptz default now()
);

-- 2. Enable RLS (Security)
alter table public.measurements enable row level security;
alter table public.measurement_images enable row level security;
alter table public.measurement_calculations enable row level security;
alter table public.debug_logs enable row level security;

-- 3. Create Policies (Drop first to ensure update)
-- Measurements
drop policy if exists "Public Insert Measurements" on public.measurements;
create policy "Public Insert Measurements" on public.measurements for insert with check (true);

drop policy if exists "Public Select Measurements" on public.measurements;
create policy "Public Select Measurements" on public.measurements for select using (true);

-- Images
drop policy if exists "Public Insert Images" on public.measurement_images;
create policy "Public Insert Images" on public.measurement_images for insert with check (true);

drop policy if exists "Public Select Images" on public.measurement_images;
create policy "Public Select Images" on public.measurement_images for select using (true);

-- Calculations
drop policy if exists "Public Insert Calcs" on public.measurement_calculations;
create policy "Public Insert Calcs" on public.measurement_calculations for insert with check (true);

drop policy if exists "Public Select Calcs" on public.measurement_calculations;
create policy "Public Select Calcs" on public.measurement_calculations for select using (true);

-- Debug Logs
drop policy if exists "Public Insert Logs" on public.debug_logs;
create policy "Public Insert Logs" on public.debug_logs for insert with check (true);

drop policy if exists "Public Select Logs" on public.debug_logs;
create policy "Public Select Logs" on public.debug_logs for select using (true);

-- 4. Create Storage Bucket for Images
insert into storage.buckets (id, name, public) 
values ('scans', 'scans', true)
on conflict (id) do nothing;

-- 5. Storage Policies
drop policy if exists "Public Upload Scans" on storage.objects;
create policy "Public Upload Scans" on storage.objects for insert with check ( bucket_id = 'scans' );

drop policy if exists "Public Select Scans" on storage.objects;
create policy "Public Select Scans" on storage.objects for select using ( bucket_id = 'scans' );
  `.trim();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-slate-900 p-4 flex justify-between items-center shrink-0">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Cpu size={18} className="text-blue-400" /> Settings
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto p-6 space-y-6">
          
          <form onSubmit={handleSave} className="space-y-6">
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

            {/* Schema Helper */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
               <button 
                 type="button" 
                 onClick={() => setShowSchema(!showSchema)}
                 className="w-full bg-slate-50 p-3 text-xs font-bold text-slate-600 flex justify-between items-center hover:bg-slate-100 transition-colors"
               >
                 <span className="flex items-center gap-2"><Code size={14}/> Database Setup Instructions</span>
                 <span>{showSchema ? 'Hide' : 'Show'}</span>
               </button>
               
               {showSchema && (
                 <div className="p-4 bg-slate-900 relative group">
                    <div className="text-slate-300 text-xs mb-3 space-y-2">
                      <p><strong className="text-white">Step 1:</strong> Copy the SQL script below.</p>
                      <p><strong className="text-white">Step 2:</strong> Go to the <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1">Supabase SQL Editor <ExternalLink size={10}/></a>.</p>
                      <p><strong className="text-white">Step 3:</strong> Paste the script and click <strong>"Run"</strong> to create your tables.</p>
                    </div>
                    
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => copyToClipboard(schemaSQL)}
                        className={`absolute top-2 right-2 p-1.5 rounded transition-all z-10 flex items-center gap-1 ${
                          copied ? 'bg-green-500/20 text-green-300' : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                        title="Copy SQL"
                      >
                        {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                        <span className="text-[10px] font-bold">{copied ? 'Copied!' : 'Copy SQL'}</span>
                      </button>
                      <pre className="text-[10px] text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap p-3 pt-8 bg-black/30 rounded border border-white/10 max-h-60">
                        {schemaSQL}
                      </pre>
                    </div>
                 </div>
               )}
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
    </div>
  );
};