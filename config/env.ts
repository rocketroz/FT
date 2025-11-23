/**
 * Environment Configuration
 * 
 * This file provides type-safe access to environment variables.
 * All sensitive credentials should be stored in .env file (local)
 * or GitHub Secrets (CI/CD) and never committed to version control.
 */

interface EnvironmentConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  googleAI: {
    apiKey: string;
  };
}

/**
 * Validates that required environment variables are present
 */
function validateEnv(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'GOOGLE_AI_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env file or environment configuration.`
    );
  }
}

/**
 * Get environment configuration with validation
 */
export function getEnvConfig(): EnvironmentConfig {
  validateEnv();

  return {
    supabase: {
      url: process.env.SUPABASE_URL!,
      anonKey: process.env.SUPABASE_ANON_KEY!,
    },
    googleAI: {
      apiKey: process.env.GOOGLE_AI_API_KEY!,
    },
  };
}

/**
 * Export individual config sections for convenience
 */
export const supabaseConfig = {
  get url() {
    return getEnvConfig().supabase.url;
  },
  get anonKey() {
    return getEnvConfig().supabase.anonKey;
  },
};

export const googleAIConfig = {
  get apiKey() {
    return getEnvConfig().googleAI.apiKey;
  },
};

// Validate on module load (optional - comment out if you want lazy validation)
// validateEnv();
