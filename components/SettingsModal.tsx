import React, { useState, useEffect } from 'react';
import { X, Save, Database, CheckCircle, AlertCircle, Shield, Cpu, Activity, Code, Copy, ExternalLink, CloudLightning, Github } from 'lucide-react';
import { configureSupabase, isSupabaseConnected, getSupabaseConfig } from '../services/supabaseService';

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
  const [usingEnvVars, setUsingEnvVars] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Local state for the model to allow immediate feedback before saving/closing
  const [selectedModel, setSelectedModel] = useState(currentModel);

  useEffect(() => {
    if (isOpen) {
      const isConnected = isSupabaseConnected();
      setConnected(isConnected);
      
      // 1. Try to load from Local Storage (persisted)
      let stored = null;
      try {
        stored = localStorage.getItem('fit_twin_supabase_config');
      } catch (e) { /* Ignore Incognito blocks */ }

      if (stored) {
        const config = JSON.parse(stored);
        setUrl(config.url || '');
        setKey(config.key || '');
        setUsingEnvVars(false);
      } else {
        // 2. Check detected environment variables or defaults
        const envConfig = getSupabaseConfig();
        
        if (isConnected && !stored) {
          // Connected + No Storage = Connected via Env Vars
          setUsingEnvVars(true);
          setUrl(envConfig.url || ''); 
          setKey(envConfig.key ? '••••••••' : ''); 
        } else {
          // Pre-fill config if available
          if (envConfig.url || envConfig.key) {
             setUrl(envConfig.url || '');
             setKey(envConfig.key || '');
          }
        }
      }
      
      setSelectedModel(currentModel);
    }
  }, [isOpen, currentModel]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const success = configureSupabase(url, key);
    setConnected(success);
    setUsingEnvVars(false); // Manual override implies strictly not using auto-env vars
    
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
-- Source: https://github.com/rocketroz/FT/blob/main/supabase_setup.sql
-- Schema Version: 2.3 (Complete Permissions)
-- NOTE: "Success. No rows returned" is the standard success message for this script.

-- 1. SETUP EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. CREATE TABLES
create table if not exists public.measurements (
  id uuid default gen_random_uuid() primary key,
  session_id text,
  user_id uuid,
  created_at timestamptz default now(),
  height numeric,
  weight numeric,
  gender text,
  age numeric,
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
  confidence numeric,
  model_name text,
  scaling_factor numeric,
  estimated_height_cm numeric,
  capture_method text,
  full_json jsonb,
  landmarks_json jsonb,
  token_count numeric,
  thinking_tokens numeric,
  api_cost_usd numeric,
  thought_summary text
);

-- Ensure columns exist (for migration from older versions)
alter table public.measurements add column if not exists full_json jsonb;
alter table public.measurements add column if not exists landmarks_json jsonb;
alter table public.measurements add column if not exists thinking_tokens numeric;
alter table public.measurements add column if not exists api_cost_usd numeric;
alter table public.measurements add column if not exists thought_summary text;

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

create table if not exists public.debug_logs (
  id uuid default gen_random_uuid() primary key,
  session_id text,
  level text,
  message text,
  data jsonb,
  device_info jsonb,
  created_at timestamptz default now()
);

-- 3. ENABLE SECURITY (RLS)
alter table public.measurements enable row level security;
alter table public.measurement_images enable row level security;
alter table public.measurement_calculations enable row level security;
alter table public.debug_logs enable row level security;

-- 4. POLICIES

-- Measurements
drop policy if exists "policy_insert_measurements" on public.measurements;
create policy "policy_insert_measurements" on public.measurements for insert with check (true);

drop policy if exists "policy_select_measurements" on public.measurements;
create policy "policy_select_measurements" on public.measurements for select using (true);

-- Images
drop policy if exists "policy_insert_images" on public.measurement_images;
create policy "policy_insert_images" on public.measurement_images for insert with check (true);

drop policy if exists "policy_select_images" on public.measurement_images;
create policy "policy_select_images" on public.measurement_images for select using (true);

-- Calculations
drop policy if exists "policy_insert_calcs" on public.measurement_calculations;
create policy "policy_insert_calcs" on public.measurement_calculations for insert with check (true);

drop policy if exists "policy_select_calcs" on public.measurement_calculations;
create policy "policy_select_calcs" on public.measurement_calculations for select using (true);

-- Debug Logs
drop policy if exists "policy_insert_logs" on public.debug_logs;
create policy "policy_insert_logs" on public.debug_logs for insert with check (true);

drop policy if exists "policy_select_logs" on public.debug_logs;
create policy "policy_select_logs" on public.debug_logs for select using (true);

-- 5. STORAGE SETUP
insert into storage.buckets (id, name, public) 
values ('scans', 'scans', true)
on conflict (id) do nothing;

drop policy if exists "policy_upload_scans" on storage.objects;
create policy "policy_upload_scans" on storage.objects for insert with check ( bucket_id = 'scans' );

drop policy if exists "policy_select_scans" on storage.objects;
create policy "policy_select_scans" on storage.objects for select using ( bucket_id = 'scans' );

-- 6. VIEWS (Analytics)
drop view if exists public.measurements_with_concerns;
create view public.measurements_with_concerns as
select 
  id, 
  created_at, 
  user_id,
  model_name, 
  confidence,
  full_json->'fit_concerns' as fit_concerns
from public.measurements
where full_json->'fit_concerns' is not null 
  and jsonb_array_length(full_json->'fit_concerns') > 0;

drop view if exists public.model_performance;
create view public.model_performance as
select
  model_name,
  count(*) as total_scans,
  avg(confidence) as avg_confidence,
  avg(token_count) as avg_tokens,
  avg(thinking_tokens) as avg_thinking_tokens
from public.measurements
group by model_name;

-- 7. PERMISSIONS (CRITICAL)
-- Grant usage on schema public to all users including anon
grant usage on schema public to anon, authenticated, service_role;

-- Grant access to tables
grant all on all tables in schema public to anon, authenticated, service_role;

-- Grant access to sequences (if any are used implicitly)
grant all on all sequences in schema public to anon, authenticated, service_role;

-- Grant access to routines/functions
grant all on all routines in schema public to anon, authenticated, service_role;
  `.trim();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
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
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input 
                    type="radio" 
                    name="model" 
                    value="gemini-3-pro-preview" 
                    checked={selectedModel === 'gemini-3-pro-preview'} 
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block font-bold text-slate-900 text-sm">Gemini 3 Pro</span>
                    <span className="block text-xs text-slate-500">Highest accuracy, slower reasoning</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors">
                  <input 
                    type="radio" 
                    name="model" 
                    value="gemini-2.5-flash" 
                    checked={selectedModel === 'gemini-2.5-flash'} 
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="block font-bold text-slate-900 text-sm flex items-center gap-1">
                      Gemini 2.5 Flash <CloudLightning size={10} className="text-amber-500"/>
                    </span>
                    <span className="block text-xs text-slate-500">Faster, includes Thinking logic</span>
                  </div>
                </label>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Supabase Config Section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Database size={14} /> Cloud Database
                </h4>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 uppercase ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {connected ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                  {connected ? 'Connected' : 'Not Connected'}
                </div>
              </div>
              
              {usingEnvVars ? (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4 text-center">
                  <Shield size={24} className="mx-auto text-blue-600 mb-2" />
                  <p className="text-sm text-blue-800 font-bold">Automatic Configuration</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Supabase configuration is loaded from your Environment Variables.
                  </p>
                  <button 
                    type="button" 
                    onClick={() => setUsingEnvVars(false)}
                    className="mt-3 text-xs text-blue-700 underline hover:text-blue-900"
                  >
                    Override manually
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Project URL</label>
                    <input 
                      type="url" 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://xyz.supabase.co"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Anon Key</label>
                    <input 
                      type="password" 
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Use the <b>anon / public</b> key. This configuration is saved locally in your browser.
                  </div>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${saved ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              {saved ? <CheckCircle size={18} /> : <Save size={18} />}
              {saved ? 'Saved Successfully' : 'Save Changes'}
            </button>
          </form>

          {/* Admin Tools */}
          <div className="pt-6 border-t border-slate-100">
             <div className="flex gap-2">
                <button 
                  onClick={() => setShowSchema(!showSchema)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg flex items-center justify-center gap-2"
                >
                  <Code size={14} /> Get SQL Schema
                </button>
                {connected && onNavigateToAdmin && (
                  <button 
                    onClick={onNavigateToAdmin}
                    className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-lg flex items-center justify-center gap-2"
                  >
                    <Shield size={14} /> Admin Dashboard
                  </button>
                )}
             </div>
          </div>

        </div>
      </div>

      {/* Schema Modal Overlay */}
      {showSchema && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
           <div className="bg-slate-900 w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col max-h-[80vh]">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                 <h4 className="text-white font-bold flex items-center gap-2"><Database size={16}/> Database Setup SQL</h4>
                 <button onClick={() => setShowSchema(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-auto p-0 bg-[#0d1117]">
                 <pre className="text-[10px] font-mono text-slate-300 p-4 leading-relaxed">{schemaSQL}</pre>
              </div>
              <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-between items-center">
                 <div className="flex gap-4 items-center">
                   <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-400 text-xs hover:underline flex items-center gap-1"><ExternalLink size={12}/> Dashboard</a>
                   <a href="https://github.com/rocketroz/FT/blob/main/supabase_setup.sql" target="_blank" rel="noreferrer" className="text-slate-400 text-xs hover:text-white hover:underline flex items-center gap-1 transition-colors">
                      <Github size={12}/> View on GitHub
                   </a>
                 </div>
                 <button 
                   onClick={() => copyToClipboard(schemaSQL)}
                   className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 ${copied ? 'bg-green-600 text-white' : 'bg-white text-slate-900 hover:bg-slate-200'}`}
                 >
                    {copied ? <CheckCircle size={14}/> : <Copy size={14}/>}
                    {copied ? 'Copied!' : 'Copy SQL'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};