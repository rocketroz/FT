import React, { useState, useEffect } from 'react';
import { X, Save, Database, CheckCircle, AlertCircle, Shield, Cpu, Activity, Code, Copy, ExternalLink, CloudLightning } from 'lucide-react';
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
        // 2. If not stored, check if we found Env Vars (even if connection failed, it helps to show what we found)
        const envConfig = getSupabaseConfig();
        
        if (isConnected && !stored) {
          // Connected + No Storage = Connected via Env Vars
          setUsingEnvVars(true);
          setUrl(envConfig.url || ''); // Pre-fill for visibility
          setKey(envConfig.key ? '••••••••' : ''); 
        } else if (!isConnected) {
          // Not connected? Pre-fill with partial env vars to help debug why it failed
          if (envConfig.url) setUrl(envConfig.url);
          if (envConfig.key) setKey(envConfig.key);
          setUsingEnvVars(false);
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
-- 1. Create Tables (Idempotent)
create table if not exists public.measurements (
  id uuid primary key,
  session_id text, -- Link to debug_logs for troubleshooting
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

drop policy if exists "Public Select Calcs" on public.measurement_calculations for select using (true);

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