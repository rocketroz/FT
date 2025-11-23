# Implementation Instructions for Gemini

**From:** Manus  
**To:** Gemini AI Assistant  
**Date:** November 23, 2025  
**Re:** Database Setup & Schema Alignment

---

## 🚨 CRITICAL: Database Tables Don't Exist Yet

The `supabaseService.ts` you created is trying to insert into tables that **haven't been created** in Supabase yet. This is causing the database error.

---

## ✅ SOLUTION: Run the SQL Migration

### Step 1: Open Supabase SQL Editor

1. Go to: **https://jgpohanlfydazveufmsk.supabase.co**
2. Click **SQL Editor** in the left sidebar
3. Click **New query**

### Step 2: Copy and Run the Schema

1. Open the file `supabase_setup.sql` in this repository (379 lines)
2. Copy the **entire contents**
3. Paste into the Supabase SQL Editor
4. Click **Run** (or press Ctrl/Cmd + Enter)

### Step 3: Verify Tables Were Created

Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

You should see these tables:
- ✅ `measurements`
- ✅ `fit_concerns`
- ✅ `population_stats`
- ✅ `ab_test_comparisons`
- ✅ `measurement_images` (if you added it)
- ✅ `measurement_calculations` (if you added it)

---

## 📋 Schema Overview

The `supabase_setup.sql` file creates:

### Table: `measurements`
**Purpose:** Store all body measurements + transparency data

**Key Columns:**
```sql
-- Primary Key
id UUID PRIMARY KEY

-- User & Timestamps
user_id UUID NOT NULL
created_at TIMESTAMP
updated_at TIMESTAMP

-- User Input
height DECIMAL(5,2)
weight DECIMAL(5,2)
age INTEGER
gender TEXT

-- Body Measurements (cm)
neck, shoulder, chest, bicep, wrist, sleeve
waist, hips
inseam, outseam, thigh, calf, ankle
torso_length

-- Quality & Confidence
confidence INTEGER (0-100)
notes TEXT
thought_summary TEXT
body_shape TEXT

-- Transparency Fields (YOUR CODE USES THESE)
scaling_factor DECIMAL(10,6)
landmarks_json JSONB          -- ← Your code stores landmarks here
technical_analysis JSONB      -- ← Your code stores formulas/raw pixels here
quality_assessment JSONB

-- A/B Testing
model_name TEXT               -- ← Your code stores this
thinking_tokens INTEGER       -- ← Your code stores this

-- API Tracking
token_count INTEGER           -- ← Your code stores this
api_cost_usd DECIMAL(10,6)    -- ← Your code calculates this

-- Image References (optional)
front_image_url TEXT
side_image_url TEXT
```

### Table: `fit_concerns`
**Purpose:** Store fit concerns (normalized)

```sql
id UUID PRIMARY KEY
measurement_id UUID REFERENCES measurements(id)
area TEXT                     -- e.g., 'shoulders', 'waist'
issue TEXT                    -- e.g., 'broad shoulders'
severity TEXT                 -- 'low', 'medium', 'high'
advice TEXT
percentile INTEGER
deviation_from_avg DECIMAL(5,2)
```

### Table: `population_stats`
**Purpose:** Reference data for population comparisons

```sql
gender TEXT                   -- 'male', 'female', 'all'
region TEXT                   -- 'US', 'EU', etc.
measurement_name TEXT         -- 'chest', 'waist', 'shoulder'
mean_cm DECIMAL(5,2)
std_dev_cm DECIMAL(5,2)
p10, p25, p50, p75, p90      -- Percentiles
```

**Seeded Data:** 16 rows of US population averages (male/female) from CDC

### Table: `ab_test_comparisons`
**Purpose:** A/B testing results

```sql
user_id UUID
session_id UUID
measurement_a_id UUID         -- Gemini 3 Pro result
model_a TEXT
measurement_b_id UUID         -- Gemini 2.5 Flash result
model_b TEXT
confidence_diff INTEGER
token_diff INTEGER
cost_diff_usd DECIMAL(10,6)
preferred_model TEXT
feedback_notes TEXT
```

---

## 🔧 Your Code Alignment

### ✅ What's Already Correct in `supabaseService.ts`

Your code (lines 137-172) correctly maps to the schema:

```typescript
await supabase.from('measurements').insert([{
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
  confidence_score: results.confidence,      // ⚠️ Should be: confidence
  
  // Transparency Fields
  model_name: results.model_name,            // ✅ Correct
  scaling_factor: results.scaling_factor,    // ✅ Correct
  estimated_height_cm: results.estimated_height_cm,  // ✅ Correct
  thought_summary: results.thought_summary,  // ✅ Correct
  landmarks_json: landmarksJson,             // ✅ Correct
  token_count: results.usage_metadata?.totalTokenCount,  // ✅ Correct
  thinking_tokens: results.usage_metadata?.thinkingTokenCount,  // ✅ Correct
  api_cost_usd: cost                         // ✅ Correct
}])
```

### ⚠️ Minor Fix Needed

**Line 157:** Change `confidence_score` to `confidence`

```typescript
// BEFORE:
confidence_score: results.confidence,

// AFTER:
confidence: results.confidence,
```

The schema column is named `confidence`, not `confidence_score`.

---

## 🔍 Additional Tables You're Using

Your code references these tables (lines 180-209):

### `measurement_images`
**Purpose:** Store image URLs

```sql
CREATE TABLE IF NOT EXISTS public.measurement_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  measurement_id UUID REFERENCES measurements(id) ON DELETE CASCADE,
  view_type TEXT,              -- 'front' or 'side'
  public_url TEXT,
  storage_path TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `measurement_calculations`
**Purpose:** Transparency log for formulas/pixels

```sql
CREATE TABLE IF NOT EXISTS public.measurement_calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  measurement_id UUID REFERENCES measurements(id) ON DELETE CASCADE,
  metric_name TEXT,            -- 'global_scaling', 'chest', 'waist', etc.
  raw_pixels TEXT,             -- JSON string of pixel measurements
  scaling_factor DECIMAL(10,6),
  formula TEXT,                -- e.g., "π × √(2(a² + b²))"
  created_at TIMESTAMP DEFAULT NOW()
);
```

**ACTION NEEDED:** Add these two table definitions to `supabase_setup.sql` if they're not already there.

---

## 📝 Recommended Schema Additions

Add these tables to `supabase_setup.sql` (append at the end, before the final verification query):

```sql
-- =====================================================
-- ADDITIONAL TABLES FOR GEMINI'S IMPLEMENTATION
-- =====================================================

-- Table: measurement_images
CREATE TABLE IF NOT EXISTS public.measurement_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  measurement_id UUID NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,
  view_type TEXT NOT NULL CHECK (view_type IN ('front', 'side', 'model_obj', 'model_usdz')),
  public_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_measurement_images_measurement_id 
  ON public.measurement_images(measurement_id);

-- RLS Policy
ALTER TABLE public.measurement_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own measurement images" 
  ON public.measurement_images FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.measurements 
      WHERE measurements.id = measurement_images.measurement_id 
      AND measurements.user_id = auth.uid()
    )
  );

-- Table: measurement_calculations
CREATE TABLE IF NOT EXISTS public.measurement_calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  measurement_id UUID NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  raw_pixels TEXT,
  scaling_factor DECIMAL(10,6),
  formula TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_measurement_calculations_measurement_id 
  ON public.measurement_calculations(measurement_id);

-- RLS Policy
ALTER TABLE public.measurement_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own measurement calculations" 
  ON public.measurement_calculations FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.measurements 
      WHERE measurements.id = measurement_calculations.measurement_id 
      AND measurements.user_id = auth.uid()
    )
  );
```

---

## ✅ Verification Checklist

After running the migration:

- [ ] All tables created successfully
- [ ] No SQL errors in Supabase logs
- [ ] Population stats seeded (16 rows)
- [ ] RLS policies enabled
- [ ] Test insert works:
  ```sql
  INSERT INTO measurements (user_id, height, chest, waist, hips, confidence)
  VALUES (auth.uid(), 175, 100, 85, 95, 90);
  ```
- [ ] Test query works:
  ```sql
  SELECT * FROM measurements WHERE user_id = auth.uid();
  ```

---

## 🎯 Next Steps After Migration

1. **Fix the column name:** Change `confidence_score` to `confidence` in `supabaseService.ts` (line 157)

2. **Add the two additional tables:** Copy the SQL from "Recommended Schema Additions" above and run in Supabase

3. **Test the full flow:**
   - Capture images
   - Analyze with Gemini
   - Save to Supabase
   - Verify data appears in `measurements` table

4. **Check for errors:** Monitor browser console and Supabase logs

---

## 🔒 Security Notes

- ✅ RLS policies are enabled - users can only see their own data
- ✅ The `user_id` column uses `auth.uid()` from Supabase Auth
- ⚠️ Make sure users are authenticated before calling `saveScanResult()`
- ⚠️ The schema assumes you're using Supabase Auth (`auth.users` table)

---

## 📞 If You Encounter Errors

### Error: "relation 'measurements' does not exist"
**Cause:** Migration not run  
**Fix:** Run `supabase_setup.sql` in SQL Editor

### Error: "column 'confidence_score' does not exist"
**Cause:** Column name mismatch  
**Fix:** Change to `confidence` in supabaseService.ts

### Error: "relation 'measurement_images' does not exist"
**Cause:** Additional tables not created  
**Fix:** Add the two tables from "Recommended Schema Additions"

### Error: "new row violates row-level security policy"
**Cause:** User not authenticated or RLS policy issue  
**Fix:** Ensure `auth.uid()` returns a valid user ID

---

## 🤝 Coordination with Manus

**Manus has:**
- ✅ Created the complete database schema
- ✅ Defined all tables, columns, and relationships
- ✅ Added RLS policies for security
- ✅ Seeded population reference data

**Gemini has:**
- ✅ Created excellent service layer code
- ✅ Implemented structured landmarks
- ✅ Added dual model support
- ⚠️ Needs to run the migration to create tables

**Together we have:**
- ✅ Complete backend architecture
- ✅ Proper data model
- ✅ Security policies
- ✅ Service integration

**Just need:**
- ⏳ Run the SQL migration
- ⏳ Fix one column name
- ⏳ Add two additional tables
- ⏳ Test end-to-end

---

## 🚀 You're Almost There!

The schema is solid, your code is excellent, we just need to create the tables in Supabase. Run the migration and you'll be up and running!

---

**Questions? Issues? Let me know!**

— Manus
