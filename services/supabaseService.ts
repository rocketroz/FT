
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { UserStats, MeasurementResult, CaptureMetadata } from '../types';

const STORAGE_KEY = 'fit_twin_supabase_config';

export let supabase: SupabaseClient | null = null;

// Initialize Supabase Logic
export const initSupabase = (): boolean => {
  try {
    const envUrl = process.env.SUPABASE_URL;
    const envKey = process.env.SUPABASE_ANON_KEY;

    if (envUrl && envKey) {
      supabase = createClient(envUrl, envKey);
      return true;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { url, key } = JSON.parse(stored);
      if (url && key) {
        supabase = createClient(url, key);
        return true;
      }
    }
  } catch (e) {
    console.error("Error initializing Supabase client", e);
  }
  
  return false;
};

export const configureSupabase = (url: string, key: string) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, key }));
  return initSupabase();
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
    console.error(`Upload failed for ${path}`, error);
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
    const scanId = crypto.randomUUID(); // Client-side generated ID for relation linking
    const timestamp = Date.now();

    // 1. Upload Files
    const frontBlob = await base64ToBlob(images.front);
    const sideBlob = await base64ToBlob(images.side);

    const frontUrl = await uploadFile('scans', `${userId}/${scanId}/front_${timestamp}.jpg`, frontBlob);
    const sideUrl = await uploadFile('scans', `${userId}/${scanId}/side_${timestamp}.jpg`, sideBlob);

    let objUrl = null;
    let usdzUrl = null;
    if (models.objBlob) objUrl = await uploadFile('scans', `${userId}/${scanId}/model_${timestamp}.obj`, models.objBlob);
    if (models.usdzBlob) usdzUrl = await uploadFile('scans', `${userId}/${scanId}/model_${timestamp}.usdz`, models.usdzBlob);

    // Calculate approximate cost (Simulated)
    const cost = (results.usage_metadata?.totalTokenCount || 0) * 0.000004; // $4 per 1M tokens approx for generic 2.5 input

    // Prepare JSON for landmarks (combining front and side)
    const landmarksJson = {
      front: results.landmarks_front || results.landmarks?.front,
      side: results.landmarks_side || results.landmarks?.side
    };

    // 2. Insert Main Measurement Record
    const { data: measurementData, error: measurementError } = await supabase
      .from('measurements')
      .insert([{
        id: scanId,
        user_id: user ? user.id : null,
        gender: stats.gender || 'Not Specified',
        height: stats.height,
        weight: stats.weight || null,
        age: stats.age || null,
        
        // Measurements
        chest: results.chest,
        waist: results.waist,
        hips: results.hips,
        shoulder: results.shoulder,
        inseam: results.inseam,
        neck: results.neck,
        sleeve: results.sleeve,
        
        // Meta
        confidence_score: results.confidence,
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
      }])
      .select()
      .single();

    if (measurementError) throw measurementError;

    // 3. Insert Related Data (Parallel for speed)
    const promises = [];

    // Table: measurement_images
    if (frontUrl) {
      promises.push(supabase.from('measurement_images').insert({ measurement_id: scanId, view_type: 'front', public_url: frontUrl, storage_path: `${userId}/${scanId}/front.jpg` }));
    }
    if (sideUrl) {
      promises.push(supabase.from('measurement_images').insert({ measurement_id: scanId, view_type: 'side', public_url: sideUrl, storage_path: `${userId}/${scanId}/side.jpg` }));
    }

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

    return measurementData;
  } catch (err) {
    console.error('Supabase operation failed:', err);
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
