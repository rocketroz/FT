import { supabase } from './supabaseService';

// Generate a session ID for this page load (non-secure context fallback included)
const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const SESSION_ID = generateSessionId();
const DEVICE_INFO = {
  userAgent: navigator.userAgent,
  screenSize: `${window.innerWidth}x${window.innerHeight}`,
  pixelRatio: window.devicePixelRatio,
  platform: navigator.platform,
  vendor: navigator.vendor
};

type LogLevel = 'info' | 'warn' | 'error';

const logToSupabase = async (level: LogLevel, message: string, data?: any) => {
  if (!supabase) return; // Silent fail if not connected

  try {
    await supabase.from('debug_logs').insert({
      session_id: SESSION_ID,
      level,
      message,
      data: data ? JSON.stringify(data) : null,
      device_info: DEVICE_INFO
    });
  } catch (e) {
    console.warn("Failed to send remote log", e);
  }
};

export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data || '');
    logToSupabase('info', message, data);
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data || '');
    logToSupabase('warn', message, data);
  },
  error: (message: string, data?: any) => {
    console.error(`[ERROR] ${message}`, data || '');
    logToSupabase('error', message, data);
  },
  getSessionId: () => SESSION_ID
};