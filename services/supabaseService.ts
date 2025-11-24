import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { UserStats, MeasurementResult, CaptureMetadata } from '../types';
import { logger } from './logger';

const STORAGE_KEY = 'fit_twin_supabase_config';

export let supabase: SupabaseClient | null = null;

// --- Connection Event System ---
type ConnectionListener = (isConnected: boolean) => void;
const connectionListeners: ConnectionListener[] = [];

export const onSupabaseConnectionChange = (callback: ConnectionListener) => {
  connectionListeners.push(callback);
  // Fire immediately with current state
  callback(!!supabase);
  return () => {
    const index = connectionListeners.indexOf(callback);
    if (index > -1) connectionListeners.splice(index, 1);
  };
};

const notifyListeners = (status: boolean) => {
  connectionListeners.forEach(l => l(status));
};

// Helper to check if localStorage is writable
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

export const getSupabaseConfig = () => {
  let url = '';
  let key = '';

  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || import.meta.env.REACT_APP_SUPABASE_URL;
      // @ts-ignore
      key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || import.meta.env.REACT_APP_SUPABASE_ANON_KEY;
    }
  } catch (e) { /* Ignore */ }

  if (!url || !key) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        url = process.env.VITE_SUPABASE_URL || 
              process.env.NEXT_PUBLIC_SUPABASE_URL || 
              process.env.REACT_APP_SUPABASE_URL || 
              process.env.SUPABASE_URL || '';
              
        key = process.env.VITE_SUPABASE_ANON_KEY || 
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
              process.env.REACT_APP_SUPABASE_ANON_KEY || 
              process.env.SUPABASE_ANON_KEY || '';
      }
    } catch (e) { /* Ignore */ }
  }

  return { url, key };
};

export const initSupabase = (): boolean => {
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

    const { url: envUrl, key: envKey } = getSupabaseConfig();

    if (envUrl && envKey) {
      console.log("[Supabase] Initializing from Environment Variables");
      supabase = createClient(envUrl, envKey, options);
      notifyListeners(true);
      return true;
    }

    if (isStorageAvailable()) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const { url, key } = JSON.parse(stored);
          if (url && key) {
            console.log("[Supabase] Initializing from LocalStorage");
            supabase = createClient(url, key, options);
            notifyListeners(true);
            return true;
          }
        }
      } catch (storageError) {
        console.warn("[Supabase] LocalStorage error:", storageError);
      }
    }
    
    // Even if no config found, checking returning false is enough
    if (!supabase) {
      console.warn("[Supabase] No configuration found.");
      notifyListeners(false);
      return false;
    }

    return true;

  } catch (e) {
    console.error("[Supabase] Init error", e);
    notifyListeners(false);
  }
  
  return false;
};

export const configureSupabase = (url: string, key: string) => {
  try {
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

export const isSupabaseConnected = (): boolean => {
  return !!supabase;
};

// --- AUTH SERVICES ---
export const signUp = async (email: string, password: string) => {
  if (!supabase && !initSupabase()) return { user: null, session: null, error: { message: "Database not connected" } };
  
  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
  });
  return { user: data.user, session: data.session, error };
};

export const signIn = async (email: string, password: string) => {
  if (!supabase && !initSupabase()) return { user: null, session: null, error: { message: "Database not connected" } };

  const { data, error } = await supabase!.auth.signInWithPassword({
    email,
    password,
  });
  return { user: data.user, session: data.session, error };
};

export const signInWithGoogle = async () => {
  if (!supabase && !initSupabase()) return { error: { message: "Database not connected" } };

  const { data, error } = await supabase!.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  return { data, error };
};

export const signOut = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
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

    const { data: { publicUrl } } = supabase.storage.from('scans').getPublicUrl(fileName);
    return publicUrl;
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
) => {
  if (!supabase && !initSupabase()) return { success: false, error: { message: "Database not connected" } };

  try {
    const user = await getUser();
    const userId = user ? user.id : 'anon';
    const sessionId = logger.getSessionId(); // Link to debug logs

    // 1. Upload Images
    const frontUrl = await uploadImage(userId, images.front, 'front');
    const sideUrl = await uploadImage(userId, images.side, 'side');

    // 2. Save Main Record
    const { data: measurementData, error: measurementError } = await supabase!
      .from('measurements')
      .insert({
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

    if (measurementError) throw measurementError;

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

    return { success: true, id: measurementData.id };

  } catch (error: any) {
    console.error("Save Scan Error:", error);
    return { success: false, error };
  }
};

export const getScans = async (limit = 20) => {
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
  return data;
};