import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { UserStats, MeasurementResult, CaptureMetadata } from '../types';
import { logger } from './logger';

const STORAGE_KEY = 'fit_twin_supabase_config';

export let supabase: SupabaseClient | null = null;

// Helper to check if localStorage is writable (detects Incognito/Private mode restrictions)
const isStorageAvailable = () => {
  try {
    const testKey = '__test_storage__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

// Helper to safely access env vars across different build tools (Vite, CRA, Next.js)
// We export this so the Settings UI can check what was found
export const getSupabaseConfig = () => {
  let url = '';
  let key = '';

  try {
    // 1. Try Vite (import.meta.env) - Explicit checks for bundler replacement
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || import.meta.env.REACT_APP_SUPABASE_URL;
      // @ts-ignore
      key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || import.meta.env.REACT_APP_SUPABASE_ANON_KEY;
    }
  } catch (e) { /* Ignore access errors */ }

  // 2. Try Node/CRA (process.env) - Fallback
  if (!url || !key) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
        key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';
      }
    } catch (e) { /* Ignore process access errors */ }
  }

  return { url, key };
};

// Initialize Supabase Logic
export const initSupabase = (): boolean => {
  try {
    // Determine client options based on storage availability
    const options = isStorageAvailable() 
      ? {} // Default: Use localStorage
      : { 
          auth: { 
            persistSession: false, // Disable persistence in Incognito to avoid SecurityError
            autoRefreshToken: false,
            detectSessionInUrl: false
          } 
        };

    // Check Environment Variables First (Vercel/Deployment)
    const { url: envUrl, key: envKey } = getSupabaseConfig();

    if (envUrl && envKey) {
      // console.log("Initializing Supabase from Environment Variables");
      supabase = createClient(envUrl, envKey, options);
      return true;
    }

    // Fallback to Local Storage (Manual Settings)
    // Only attempt if storage is available
    if (isStorageAvailable()) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const { url, key } = JSON.parse(stored);
          if (url && key) {
            // console.log("Initializing Supabase from LocalStorage");
            supabase = createClient(url, key, options);
            return true;
          }
        }
      } catch (storageError) {
        console.warn("LocalStorage read failed during init:", storageError);
      }
    }

  } catch (e) {
    console.error("Error initializing Supabase client", e);
  }
  
  return false;
};

export const configureSupabase = (url: string, key: string) => {
  // Always try to init the client in memory
  try {
    const options = isStorageAvailable() 
      ? {} 
      : { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
      
    supabase = createClient(url, key, options);
    
    // Only persist if we can
    if (isStorageAvailable()) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, key }));
      } catch (e) {
        console.warn("Could not save config to localStorage", e);
      }
    } else {
      console.warn("Storage unavailable - configuration will be temporary for this session.");
    }
    return true;
  } catch (e) {
    console.error("Failed to configure Supabase:", e);
    return false;
  }
};

export const isSupabaseConnected = (): boolean => {
  return !!supabase;
};

// --- AUTH SERVICES ---
export const signUp = async (email: string, password: string): Promise<{ user: User | null, error: any }> => {
  if (!supabase) return { user: null, error: "Not connected" };
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { user: data.user, error };
};

export const signIn = async (email: string, password: string): Promise<{ user: User | null, error: any }> => {
  if (!supabase) return { user: null, error: "Not connected" };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data.user, error };
};

export const signInWithGoogle = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({ provider: 'google' });
};

export const getUser = async (): Promise<User | null> => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
};

export const signOut = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};

// --- STORAGE HELPERS ---
const base64ToBlob = async (base64: string): Promise<Blob> => {
  const response = await fetch(base64);
  return await response.blob();
};

const uploadFile = async (bucket: string, path: string, file: Blob): Promise<string | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) {
    console.warn(`Upload failed for ${path} (bucket might not exist or permissions error). Continuing...`, error);
    return null;
  }
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
};

// Initialize on load
initSupabase();

export const saveScanResult = async (
  stats: UserStats, 
  results: MeasurementResult,
  images: { front: string, side: string },
  metadata: { front: CaptureMetadata, side: CaptureMetadata },
  models: { objBlob: Blob | null, usdzBlob: Blob | null }
) => {
  // Ensure we are initialized
  if (!supabase) {
    initSupabase();
  }

  if (!supabase) {
    console.warn("Supabase not connected. Saving skipped.");
    return null;
  }

  try {
    const user = await getUser();
    const userId = user ? user.id : 'anon';
    
    // Safer UUID generation for non-secure contexts (http)
    const scanId = typeof crypto.randomUUID === 'function' 
      ? crypto.randomUUID() 
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });

    const timestamp = Date.now();

    // 1. Upload Files (Non-blocking: if these fail, we still try to save the record)
    let frontUrl = null;
    let sideUrl = null;
    let objUrl = null;
    let usdzUrl = null;

    try {
      const frontBlob = await base64ToBlob(images.front);
      const sideBlob = await base64ToBlob(images.side);
      frontUrl = await uploadFile('scans', `${userId}/${scanId}/front_${timestamp}.jpg`, frontBlob);
      sideUrl = await uploadFile('scans', `${userId}/${scanId}/side_${timestamp}.jpg`, sideBlob);

      if (models.objBlob) objUrl = await uploadFile('scans', `${userId}/${scanId}/model_${timestamp}.obj`, models.objBlob);
      if (models.usdzBlob) usdzUrl = await uploadFile('scans', `${userId}/${scanId}/model_${timestamp}.usdz`, models.usdzBlob);
    } catch (uploadErr) {
      console.warn("File upload process had issues, proceeding to save record...", uploadErr);
    }

    // Calculate approximate cost (Simulated)
    const cost = (results.usage_metadata?.totalTokenCount || 0) * 0.000004;

    // Prepare JSON for landmarks (combining front and side)
    const landmarksJson = {
      front: results.landmarks_front || results.landmarks?.front,
      side: results.landmarks_side || results.landmarks?.side
    };

    // 2. Insert Main Measurement Record with FALLBACK STRATEGY
    let measurementData = null;
    let measurementError = null;

    // ATTEMPT 1: Full Schema Insert
    try {
      const fullPayload = {
        id: scanId,
        user_id: user ? user.id : null,
        session_id: logger.getSessionId(), // LINK TO DEBUG LOGS
        gender: stats.gender || 'Not Specified',
        height: stats.height,
        weight: stats.weight || null,
        age: stats.age || null,
        
        // Measurements
        chest: results.chest,
        waist: results.waist,
        hips: results.hips,
        shoulder: results.shoulder,
        neck: results.neck,
        sleeve: results.sleeve,
        
        // Meta
        confidence: results.confidence,
        capture_method: metadata.front.method,
        full_json: results, // Full Backup
        
        // Transparency Fields
        model_name: results.model_name,
        scaling_factor: results.scaling_factor || results.technical_analysis?.scaling.cm_per_pixel,
        estimated_height_cm: results.estimated_height_cm,
        thought_summary: results.thought_summary,
        landmarks_json: landmarksJson,
        token_count: results.usage_metadata?.totalTokenCount,
        thinking_tokens: results.usage_metadata?.thinkingTokenCount || null,
        api_cost_usd: cost
      };

      const { data, error } = await supabase
        .from('measurements')
        .insert([fullPayload])
        .select()
        .single();
      
      measurementData = data;
      measurementError = error;
    } catch (e) {
      measurementError = e;
    }

    // ATTEMPT 2: Fallback to Minimal Schema (if Full failed due to column mismatch)
    if (measurementError) {
      console.warn("Full insert failed (likely schema/column mismatch). Attempting minimal backup save.", measurementError);
      
      const backupPayload = {
        id: scanId,
        user_id: user ? user.id : null,
        full_json: results, // Use full_json to save everything without schema constraints
        // We include basic fields that nearly always exist
        height: stats.height,
        gender: stats.gender || 'Not Specified'
      };

      try {
        const { data, error } = await supabase
          .from('measurements')
          .insert([backupPayload])
          .select()
          .single();
          
        measurementData = data;
        measurementError = error; // Update error to the fallback result
        if (!error) {
          console.log("Fallback save successful.");
        }
      } catch (fallbackErr) {
         console.error("Critical: Fallback save also failed. Ensure 'full_json' column exists.", fallbackErr);
         measurementError = fallbackErr;
      }
    }

    if (measurementError) throw measurementError;

    // 3. Insert Related Data (Auxiliary tables)
    // We wrap these in try-catch so they don't block the main success if they fail
    try {
      const promises = [];

      // Table: measurement_images
      if (frontUrl) promises.push(supabase.from('measurement_images').insert({ measurement_id: scanId, view_type: 'front', public_url: frontUrl, storage_path: `${userId}/${scanId}/front.jpg` }));
      if (sideUrl) promises.push(supabase.from('measurement_images').insert({ measurement_id: scanId, view_type: 'side', public_url: sideUrl, storage_path: `${userId}/${scanId}/side.jpg` }));

      // Table: measurement_calculations (Transparency Log)
      if (results.technical_analysis) {
        // Scaling
        promises.push(supabase.from('measurement_calculations').insert({
          measurement_id: scanId,
          metric_name: 'global_scaling',
          raw_pixels: results.technical_analysis.scaling.pixel_height.toString(),
          scaling_factor: results.technical_analysis.scaling.cm_per_pixel,
          formula: `height_cm / height_px (${stats.height} / ${results.technical_analysis.scaling.pixel_height})`
        }));

        // Key areas formulas
        Object.entries(results.technical_analysis.formulas || {}).forEach(([part, formula]) => {
          const raw = results.technical_analysis?.raw_measurements[part];
          promises.push(supabase.from('measurement_calculations').insert({
            measurement_id: scanId,
            metric_name: part,
            raw_pixels: raw ? JSON.stringify(raw) : null,
            formula: formula,
            scaling_factor: results.technical_analysis?.scaling.cm_per_pixel
          }));
        });
      }

      await Promise.allSettled(promises);
    } catch (auxErr) {
      console.warn("Failed to save auxiliary data (images/calculations), but main record was saved.", auxErr);
    }

    return measurementData;
  } catch (err) {
    console.error('Supabase operation failed completely:', err);
    return null;
  }
};

export const getScans = async (limit = 20) => {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('measurements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching scans:", error);
    return [];
  }
  return data;
};