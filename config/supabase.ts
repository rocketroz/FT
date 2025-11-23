/**
 * Supabase Client Configuration
 * 
 * This file initializes and exports the Supabase client for use throughout the app.
 * Credentials are loaded from environment variables.
 */

import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './env';

/**
 * Singleton Supabase client instance
 */
export const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey
);

/**
 * Type-safe database schema (optional - can be generated from Supabase)
 * Uncomment and populate with your actual schema types
 */
// export type Database = {
//   public: {
//     Tables: {
//       measurements: {
//         Row: {
//           id: string;
//           user_id: string;
//           created_at: string;
//           // ... add all your columns
//         };
//         Insert: {
//           // ... insert types
//         };
//         Update: {
//           // ... update types
//         };
//       };
//       fit_concerns: {
//         // ... fit_concerns schema
//       };
//     };
//   };
// };

export default supabase;
