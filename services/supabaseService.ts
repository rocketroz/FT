import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { UserStats, MeasurementResult } from '../types';
import { logger } from './logger';

const STORAGE_KEY = 'fit_twin_supabase_config';

// --- CONFIGURATION ---
// Provided credentials for automatic connection
const DEFAULT_URL = 'https://jgpohanlfydazveufmsk.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpncG9oYW5sZnlkYXp2ZXVmbXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3OTc5NjEsImV4cCI6MjA3OTM3Mzk2MX0.ySx_ouGe7lqeW_4_V9OxsIM7jqGNi0bWTIhC2ktT888';

// Singleton instance
export let supabase: SupabaseClient | null = null;

// Event Listeners for connection status
const connectionListeners = new Set<(isConnected: boolean) => void>();

export const isSupabaseConnected = (): boolean => {
  return !!supabase;
};

export const onSupabaseConnectionChange = (callback: (isConnected: boolean) => void) => {
  connectionListeners.add(callback);
  // Fire immediately with current state so components sync on mount
  callback(!!supabase);
  return () => {
    connectionListeners.delete(callback);
  };
};

const notifyListeners = (status: boolean) => {
  connectionListeners.forEach(cb => {
    try {
      cb(status);
    } catch (e) {
      console.error("Error in connection listener:", e);
    }
  });
};

// Helper to check if localStorage is available and working
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

// Helper to validate URL to avoid crashes
const isValidUrl = (urlString: string) => {
  try { 
    return Boolean(new URL(urlString)); 
  }
  catch(e){ 
    return false; 
  }
};

// Helper to generate UUIDs client-side
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Robust configuration getter that safely checks multiple environments and defaults
export const getSupabaseConfig = () => {
  let url = '';
  let key = '';

  const getEnv = (name: string) => {
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        const val = import.meta.env[name] || import.meta.env[`VITE_${name}`];
        if (val) return val;
      }
    } catch (e) {}
    try {
      if (typeof process !== 'undefined' && process.env) {
        return process.env[name] || process.env[`VITE_${name}`] || process.env[`NEXT_PUBLIC_${name}`] || process.env[`REACT_APP_${name}`];
      }
    } catch (e) {}
    return '';
  };

  url = getEnv('SUPABASE_URL') || getEnv('REACT_APP_SUPABASE_URL') || '';
  key = getEnv('SUPABASE_ANON_KEY') || getEnv('REACT_APP_SUPABASE_ANON_KEY') || '';

  // Fallback to defaults if env vars are missing
  if (!url) url = DEFAULT_URL;
  if (!key) key = DEFAULT_KEY;

  return { url, key };
};

export const initSupabase = (): boolean => {
  // If already initialized, return true
  if (supabase) return true;

  try {
    const options = isStorageAvailable() 
      ? {} 
      : { 
          auth: { 
            persistSession: false, 
            autoRefreshToken: false, 
            detectSessionInUrl: true 
          } 
        };

    // 1. Priority: Check Environment Variables & Defaults
    const config = getSupabaseConfig();
    if (config.url && isValidUrl(config.url) && config.key) {
      console.log("[Supabase] Initializing from Environment/Defaults");
      supabase = createClient(config.url, config.key, options);
      notifyListeners(true);
      return true;
    }

    // 2. Secondary: Check Local Storage (User Manual Config overrides)
    if (isStorageAvailable()) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.url && isValidUrl(parsed.url) && parsed.key) {
            console.log("[Supabase] Initializing from LocalStorage Override");
            supabase = createClient(parsed.url, parsed.key, options);
            notifyListeners(true);
            return true;
          }
        }
      } catch (storageError) {
        console.warn("[Supabase] LocalStorage error:", storageError);
      }
    }
    
    // Failed to initialize
    if (!supabase) {
      notifyListeners(false);
      return false;
    }

    return true;

  } catch (e) {
    console.error("[Supabase] Init error", e);
    notifyListeners(false);
    return false;
  }
};

export const configureSupabase = (url: string, key: string) => {
  try {
    if (!url || !key) throw new Error("URL and Key are required");
    if (!isValidUrl(url)) throw new Error("Invalid URL format");

    const options = isStorageAvailable() 
      ? {} 
      : { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: true } };
      
    supabase = createClient(url, key, options);
    console.log("[Supabase] Client configured manually");
    
    if (isStorageAvailable()) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, key }));
      } catch (e) {
        console.warn("[Supabase] Save config failed", e);
      }
    }
    
    notifyListeners(true);
    return true;
  } catch (e) {
    console.error("[Supabase] Configuration failed:", e);
    notifyListeners(false);
    return false;
  }
};

// --- AUTH SERVICES ---
export const signUp = async (email: string, password: string) => {
  if (!supabase && !initSupabase()) return { user: null, session: null, error: { message: "Database not connected" } };
  
  const result = await supabase!.auth.signUp({
    email,
    password,
  });
  return { user: result.data.user, session: result.data.session, error: result.error };
};

export const signIn = async (email: string, password: string) => {
  if (!supabase && !initSupabase()) return { user: null, session: null, error: { message: "Database not connected" } };

  const result = await supabase!.auth.signInWithPassword({
    email,
    password,
  });
  return { user: result.data.user, session: result.data.session, error: result.error };
};

export const signInWithGoogle = async () => {
  if (!supabase && !initSupabase()) return { data: null, error: { message: "Database not connected" } };

  const result = await supabase!.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  return { data: result.data, error: result.error };
};

export const signOut = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  notifyListeners(true); // Keep connected status, just signed out
};

export const getUser = async (): Promise<User | null> => {
  if (!supabase && !initSupabase()) return null;
  const { data } = await supabase!.auth.getUser();
  return data.user;
};

// --- DATA SERVICES ---

// Helper for image upload
const uploadImage = async (userId: string, imageBase64: string, type: 'front' | 'side'): Promise<string | null> => {
  try {
    if (!supabase) return null;
    
    // Convert base64 to blob
    const base64Data = imageBase64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    const fileName = `${userId}/${Date.now()}_${type}.jpg`;
    
    const { data, error } = await supabase.storage
      .from('scans')
      .upload(fileName, blob, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const result = supabase.storage.from('scans').getPublicUrl(fileName);
    return result.data.publicUrl;
  } catch (e) {
    console.error("Upload exception:", e);
    return null;
  }
};

export const saveScanResult = async (
  stats: UserStats, 
  results: MeasurementResult, 
  images: { front: string, side: string },
  meta: { front: any, side: any },
  models: { objBlob: Blob | null, usdzBlob: Blob | null }
): Promise<{ success: true; id: string } | { success: false; error: { message: string } }> => {
  if (!supabase && !initSupabase()) return { success: false, error: { message: "Database not connected" } };

  try {
    const user = await getUser();
    const sessionId = logger.getSessionId();

    // 1. Upload Images
    const frontUrl = await uploadImage(user ? user.id : 'anon', images.front, 'front');
    const sideUrl = await uploadImage(user ? user.id : 'anon', images.side, 'side');

    // 2. Save Main Record
    // Explicitly generate ID here to avoid issues if the DB table was created without 'default gen_random_uuid()'
    const measurementId = generateUUID();

    const insertResult = await supabase!
      .from('measurements')
      .insert({
        id: measurementId, 
        user_id: user ? user.id : null,
        session_id: sessionId,
        height: stats.height,
        weight: stats.weight,
        gender: stats.gender,
        age: stats.age,
        
        chest: results.chest,
        waist: results.waist,
        hips: results.hips,
        shoulder: results.shoulder,
        neck: results.neck,
        sleeve: results.sleeve,
        inseam: results.inseam,
        
        confidence: results.confidence,
        model_name: results.model_name,
        scaling_factor: results.scaling_factor,
        estimated_height_cm: results.estimated_height_cm,
        thought_summary: results.thought_summary,
        
        token_count: results.usage_metadata?.totalTokenCount || results.token_count,
        thinking_tokens: results.usage_metadata?.thinkingTokenCount,
        
        // Full JSON Backup
        full_json: results,
        landmarks_json: results.landmarks
      })
      .select()
      .single();

    if (insertResult.error) throw insertResult.error;

    const measurementData = insertResult.data;

    // 3. Save Image References
    if (measurementData) {
      if (frontUrl) {
        await supabase!.from('measurement_images').insert({
          measurement_id: measurementData.id,
          view_type: 'front',
          public_url: frontUrl
        });
      }
      if (sideUrl) {
         await supabase!.from('measurement_images').insert({
          measurement_id: measurementData.id,
          view_type: 'side',
          public_url: sideUrl
        });
      }
    }

    return { success: true, id: measurementData?.id || measurementId };

  } catch (error: any) {
    console.error("Save Scan Error:", error);
    
    // Aggressive Error Parsing to avoid [object Object]
    let errorMessage = "Unknown Save Error";
    
    try {
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Try to find the most relevant message field
        const errObj = error as any;
        errorMessage = errObj.message || errObj.error_description || errObj.details || errObj.hint || JSON.stringify(errObj);
      }
    } catch (parseError) {
      errorMessage = "Error could not be parsed";
    }

    // Final cleanup if stringify resulted in unhelpful strings
    if (!errorMessage || errorMessage === '[object Object]' || errorMessage === '{}') {
       try {
         // Last resort: standard stringify
         errorMessage = JSON.stringify(error);
         if (errorMessage === '{}') errorMessage = "Unknown system error (empty object).";
       } catch (e) {
         errorMessage = "Critical: Unknown error occurred (unserializable).";
       }
    }

    return { 
      success: false, 
      error: { message: errorMessage }
    };
  }
};

export const getScans = async (limit = 20): Promise<any[]> => {
  if (!supabase && !initSupabase()) return [];
  
  const { data, error } = await supabase!
    .from('measurements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error("Get Scans Error:", error);
    return [];
  }
  // Safe return - explicitly return empty array if null
  return data || [];
};