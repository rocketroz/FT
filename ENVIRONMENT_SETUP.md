# Environment Setup Guide - Fit Twin

This guide explains how to securely configure environment variables for the Fit Twin app, including Supabase credentials and Google AI API keys.

---

## 🔐 Security Best Practices

**NEVER commit sensitive credentials to version control.**

- ✅ Use `.env` files for local development (already in `.gitignore`)
- ✅ Use GitHub Secrets for CI/CD and deployment
- ✅ Use environment variables in production (Vercel, Netlify, etc.)
- ❌ Never hardcode API keys in source code
- ❌ Never commit `.env` files to Git

---

## 📋 Required Environment Variables

The Fit Twin app requires the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous/public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |
| `GOOGLE_AI_API_KEY` | Your Google AI (Gemini) API key | `AIzaSy...` |

---

## 🛠️ Local Development Setup

### Step 1: Copy the example file

```bash
cp .env.example .env
```

### Step 2: Fill in your credentials

Edit `.env` and add your actual values:

```bash
# Supabase Configuration
SUPABASE_URL=https://jgpohanlfydazveufmsk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpncG9oYW5sZnlkYXp2ZXVmbXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3OTc5NjEsImV4cCI6MjA3OTM3Mzk2MX0.ySx_ouGe7lqeW_4_V9OxsIM7jqGNi0bWTIhC2ktT888

# Google AI Configuration
GOOGLE_AI_API_KEY=your_actual_google_ai_key_here
```

### Step 3: Verify the setup

Run your app and check that environment variables are loaded:

```bash
npm run dev
```

If you see errors about missing environment variables, check that:
1. `.env` file exists in the project root
2. All required variables are set
3. Your bundler/framework supports `.env` files (Vite, Create React App, Next.js all do)

---

## 🔧 GitHub Secrets Setup (for CI/CD)

GitHub Secrets allow you to securely store credentials for GitHub Actions workflows.

### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository: https://github.com/rocketroz/FT
2. Click **Settings** (top menu)
3. In the left sidebar, click **Secrets and variables** → **Actions**

### Step 2: Add Repository Secrets

Click **New repository secret** and add each of these:

#### Secret 1: SUPABASE_URL
- **Name**: `SUPABASE_URL`
- **Value**: `https://jgpohanlfydazveufmsk.supabase.co`

#### Secret 2: SUPABASE_ANON_KEY
- **Name**: `SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpncG9oYW5sZnlkYXp2ZXVmbXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3OTc5NjEsImV4cCI6MjA3OTM3Mzk2MX0.ySx_ouGe7lqeW_4_V9OxsIM7jqGNi0bWTIhC2ktT888`

#### Secret 3: GOOGLE_AI_API_KEY
- **Name**: `GOOGLE_AI_API_KEY`
- **Value**: `your_actual_google_ai_key_here`

### Step 3: Use in GitHub Actions

In your `.github/workflows/*.yml` files, reference secrets like this:

```yaml
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  GOOGLE_AI_API_KEY: ${{ secrets.GOOGLE_AI_API_KEY }}
```

---

## 🚀 Production Deployment

### Vercel

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add each variable:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `GOOGLE_AI_API_KEY`
4. Redeploy your app

### Netlify

1. Go to **Site settings** → **Build & deploy** → **Environment**
2. Click **Edit variables**
3. Add each variable
4. Trigger a new deploy

### Other Platforms

Most platforms (Render, Railway, Fly.io, etc.) have similar environment variable configuration in their dashboards.

---

## 📁 File Structure

After setup, your project should have:

```
/FT
├── .env                    # Local credentials (NEVER commit)
├── .env.example            # Template (safe to commit)
├── .gitignore              # Includes .env (prevents commits)
├── config/
│   ├── env.ts              # Environment config loader
│   └── supabase.ts         # Supabase client initialization
├── services/
│   └── geminiService.ts    # Uses googleAIConfig
└── ...
```

---

## ✅ Verification Checklist

Use this checklist to confirm your environment is set up correctly:

### Local Development
- [ ] `.env` file exists in project root
- [ ] `.env` contains all 3 required variables
- [ ] `.env` is listed in `.gitignore`
- [ ] App runs without environment variable errors
- [ ] Supabase connection works (can query database)
- [ ] Gemini API calls work (can analyze images)

### GitHub Secrets
- [ ] Navigated to Settings → Secrets and variables → Actions
- [ ] Added `SUPABASE_URL` secret
- [ ] Added `SUPABASE_ANON_KEY` secret
- [ ] Added `GOOGLE_AI_API_KEY` secret
- [ ] GitHub Actions can access secrets (if using CI/CD)

### Code Integration
- [ ] `config/env.ts` exists and validates environment variables
- [ ] `config/supabase.ts` uses environment config
- [ ] `services/geminiService.ts` uses `googleAIConfig.apiKey`
- [ ] No hardcoded credentials in source code

---

## 🔍 Troubleshooting

### Error: "Missing required environment variables"

**Cause**: `.env` file is missing or incomplete

**Solution**:
1. Check that `.env` exists: `ls -la .env`
2. Verify all variables are set: `cat .env`
3. Restart your dev server

### Error: "process.env is undefined"

**Cause**: Your bundler doesn't support `.env` files

**Solution**:
- **Vite**: Install `dotenv` and add to `vite.config.ts`:
  ```typescript
  import { defineConfig, loadEnv } from 'vite';
  
  export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      define: {
        'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY),
        'process.env.GOOGLE_AI_API_KEY': JSON.stringify(env.GOOGLE_AI_API_KEY),
      },
    };
  });
  ```

- **Create React App**: Prefix variables with `REACT_APP_`:
  ```bash
  REACT_APP_SUPABASE_URL=...
  REACT_APP_SUPABASE_ANON_KEY=...
  REACT_APP_GOOGLE_AI_API_KEY=...
  ```

- **Next.js**: Prefix public variables with `NEXT_PUBLIC_`:
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  # Server-side only (no prefix needed):
  GOOGLE_AI_API_KEY=...
  ```

### Error: "Supabase connection failed"

**Cause**: Incorrect Supabase URL or key

**Solution**:
1. Verify URL format: `https://xxxxx.supabase.co`
2. Verify anon key is the **public anon key**, not the service role key
3. Check Supabase dashboard: Settings → API

### Error: "Gemini API authentication failed"

**Cause**: Incorrect or missing Google AI API key

**Solution**:
1. Get your API key from https://aistudio.google.com/apikey
2. Verify the key starts with `AIzaSy`
3. Check that the key has Gemini API enabled

---

## 🔒 Security Notes

### Supabase Anon Key

The **anon key** is safe to expose in client-side code because:
- It's public by design (used in browsers)
- Access is controlled by Row Level Security (RLS) policies
- It cannot perform admin operations

**However**, you should still:
- ✅ Use environment variables (not hardcoded)
- ✅ Enable RLS policies on all tables
- ✅ Never expose the **service role key** (admin key)

### Google AI API Key

The **Google AI API key** should be protected:
- ❌ Never expose in client-side code (browser can see it)
- ✅ Use a backend proxy for API calls in production
- ✅ Set up API key restrictions in Google Cloud Console:
  - Restrict to specific APIs (Gemini API only)
  - Restrict to specific domains/IPs
  - Set usage quotas

**Recommended architecture for production**:
```
User → Frontend → Your Backend API → Google AI API
                   (hides API key)
```

---

## 📞 Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Verify all environment variables are set correctly
3. Check the console for specific error messages
4. Review Supabase logs (Dashboard → Logs)
5. Review Google AI Studio for API usage and errors

---

## 🎯 Next Steps

After setting up environment variables:

1. ✅ Test Supabase connection (query a table)
2. ✅ Test Gemini API (analyze a test image)
3. ✅ Commit `.env.example` and `config/` files to Git
4. ✅ Add GitHub Secrets for CI/CD
5. ✅ Configure production environment variables
6. ✅ Set up backend proxy for Google AI API (production)

---

**Your credentials are now securely configured! 🎉**
