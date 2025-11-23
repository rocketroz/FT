-- =====================================================
-- Fit Twin - Supabase Database Schema
-- =====================================================
-- This migration creates all tables needed for:
-- - Body measurement storage
-- - Transparency layer (landmarks, scaling, reasoning)
-- - A/B testing (Gemini 3 Pro vs 2.5 Flash)
-- - Fit concern tracking
-- - Population comparison analytics
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USERS TABLE (if not using Supabase Auth)
-- =====================================================
-- Skip this if you're using Supabase Auth (auth.users table)
-- Uncomment if you need a custom users table:

-- CREATE TABLE IF NOT EXISTS public.users (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   email TEXT UNIQUE NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- =====================================================
-- 2. MEASUREMENTS TABLE (Core Data)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.measurements (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User Reference (use auth.users if using Supabase Auth)
  user_id UUID NOT NULL,
  -- FOREIGN KEY: REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- User Input Data
  height DECIMAL(5,2) NOT NULL, -- cm
  weight DECIMAL(5,2), -- kg (optional)
  age INTEGER, -- years (optional)
  gender TEXT, -- 'male', 'female', 'other' (optional)
  
  -- Body Measurements (cm)
  neck DECIMAL(5,2),
  shoulder DECIMAL(5,2),
  chest DECIMAL(5,2),
  bicep DECIMAL(5,2),
  wrist DECIMAL(5,2),
  sleeve DECIMAL(5,2),
  waist DECIMAL(5,2),
  hips DECIMAL(5,2),
  inseam DECIMAL(5,2),
  outseam DECIMAL(5,2),
  thigh DECIMAL(5,2),
  calf DECIMAL(5,2),
  ankle DECIMAL(5,2),
  torso_length DECIMAL(5,2),
  
  -- Quality & Confidence
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  notes TEXT,
  thought_summary TEXT, -- AI reasoning summary
  body_shape TEXT, -- e.g., "athletic", "rectangular", "pear"
  
  -- Transparency Fields (JSONB for flexibility)
  scaling_factor DECIMAL(10,6), -- pixels per cm
  landmarks_json JSONB, -- {front: {...}, side: {...}}
  technical_analysis JSONB, -- raw pixel measurements, formulas
  quality_assessment JSONB, -- image quality scores, issues detected
  
  -- A/B Testing Fields
  model_name TEXT NOT NULL, -- 'gemini-3-pro-preview' or 'gemini-2.5-flash'
  thinking_tokens INTEGER, -- only for 2.5 Flash with thinking
  
  -- API Usage Tracking
  token_count INTEGER,
  api_cost_usd DECIMAL(10,6),
  
  -- Image References (optional - store URLs or paths)
  front_image_url TEXT,
  side_image_url TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_measurements_user_id ON public.measurements(user_id);
CREATE INDEX IF NOT EXISTS idx_measurements_created_at ON public.measurements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_model_name ON public.measurements(model_name);
CREATE INDEX IF NOT EXISTS idx_measurements_confidence ON public.measurements(confidence);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_measurements_landmarks ON public.measurements USING GIN (landmarks_json);
CREATE INDEX IF NOT EXISTS idx_measurements_technical ON public.measurements USING GIN (technical_analysis);

-- =====================================================
-- 3. FIT CONCERNS TABLE (Normalized)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fit_concerns (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Foreign Key to measurements
  measurement_id UUID NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,
  
  -- Fit Concern Details
  area TEXT NOT NULL, -- e.g., 'shoulders', 'waist', 'torso'
  issue TEXT NOT NULL, -- e.g., 'broad shoulders', 'long torso'
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  advice TEXT, -- recommendation for this concern
  
  -- Percentile data (optional)
  percentile INTEGER CHECK (percentile >= 0 AND percentile <= 100),
  deviation_from_avg DECIMAL(5,2), -- cm difference from population average
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fit_concerns_measurement_id ON public.fit_concerns(measurement_id);
CREATE INDEX IF NOT EXISTS idx_fit_concerns_severity ON public.fit_concerns(severity);
CREATE INDEX IF NOT EXISTS idx_fit_concerns_area ON public.fit_concerns(area);

-- =====================================================
-- 4. POPULATION STATISTICS TABLE (Reference Data)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.population_stats (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Demographics
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'all')),
  region TEXT DEFAULT 'US', -- 'US', 'EU', 'Asia', etc.
  
  -- Measurement Statistics
  measurement_name TEXT NOT NULL, -- 'chest', 'waist', 'shoulder', etc.
  mean_cm DECIMAL(5,2) NOT NULL,
  std_dev_cm DECIMAL(5,2) NOT NULL,
  
  -- Percentile Thresholds (optional)
  p10 DECIMAL(5,2), -- 10th percentile
  p25 DECIMAL(5,2), -- 25th percentile
  p50 DECIMAL(5,2), -- 50th percentile (median)
  p75 DECIMAL(5,2), -- 75th percentile
  p90 DECIMAL(5,2), -- 90th percentile
  
  -- Metadata
  source TEXT, -- 'CDC', 'WHO', etc.
  year INTEGER,
  sample_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_population_stats_gender ON public.population_stats(gender);
CREATE INDEX IF NOT EXISTS idx_population_stats_measurement ON public.population_stats(measurement_name);

-- Unique constraint to prevent duplicate stats
CREATE UNIQUE INDEX IF NOT EXISTS idx_population_stats_unique 
  ON public.population_stats(gender, region, measurement_name, source);

-- =====================================================
-- 5. A/B TEST COMPARISONS TABLE (Optional)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ab_test_comparisons (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User & Session
  user_id UUID NOT NULL,
  session_id UUID NOT NULL, -- same session, different models
  
  -- Model A (e.g., Gemini 3 Pro)
  measurement_a_id UUID REFERENCES public.measurements(id) ON DELETE CASCADE,
  model_a TEXT NOT NULL,
  
  -- Model B (e.g., Gemini 2.5 Flash)
  measurement_b_id UUID REFERENCES public.measurements(id) ON DELETE CASCADE,
  model_b TEXT NOT NULL,
  
  -- Comparison Metrics
  confidence_diff INTEGER, -- A - B
  token_diff INTEGER, -- A - B
  cost_diff_usd DECIMAL(10,6), -- A - B
  
  -- User Feedback (optional)
  preferred_model TEXT, -- 'model_a', 'model_b', 'no_preference'
  feedback_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ab_test_user_id ON public.ab_test_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_session_id ON public.ab_test_comparisons(session_id);

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fit_concerns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.population_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_comparisons ENABLE ROW LEVEL SECURITY;

-- Measurements: Users can only see their own measurements
CREATE POLICY "Users can view own measurements" 
  ON public.measurements FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own measurements" 
  ON public.measurements FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurements" 
  ON public.measurements FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own measurements" 
  ON public.measurements FOR DELETE 
  USING (auth.uid() = user_id);

-- Fit Concerns: Users can only see concerns for their measurements
CREATE POLICY "Users can view own fit concerns" 
  ON public.fit_concerns FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.measurements 
      WHERE measurements.id = fit_concerns.measurement_id 
      AND measurements.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own fit concerns" 
  ON public.fit_concerns FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.measurements 
      WHERE measurements.id = fit_concerns.measurement_id 
      AND measurements.user_id = auth.uid()
    )
  );

-- Population Stats: Read-only for all authenticated users
CREATE POLICY "Authenticated users can view population stats" 
  ON public.population_stats FOR SELECT 
  TO authenticated 
  USING (true);

-- A/B Test Comparisons: Users can only see their own comparisons
CREATE POLICY "Users can view own AB tests" 
  ON public.ab_test_comparisons FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AB tests" 
  ON public.ab_test_comparisons FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 7. SEED POPULATION STATISTICS (US Male/Female)
-- =====================================================

-- Insert CDC-based population averages for US adults
INSERT INTO public.population_stats (gender, region, measurement_name, mean_cm, std_dev_cm, source, year) VALUES
  -- Male measurements
  ('male', 'US', 'shoulder', 45.0, 4.0, 'CDC NHANES', 2020),
  ('male', 'US', 'chest', 106.0, 10.0, 'CDC NHANES', 2020),
  ('male', 'US', 'waist', 102.0, 13.0, 'CDC NHANES', 2020),
  ('male', 'US', 'hips', 106.0, 9.0, 'CDC NHANES', 2020),
  ('male', 'US', 'neck', 40.0, 3.0, 'CDC NHANES', 2020),
  ('male', 'US', 'bicep', 35.0, 4.0, 'CDC NHANES', 2020),
  ('male', 'US', 'thigh', 60.0, 6.0, 'CDC NHANES', 2020),
  ('male', 'US', 'calf', 39.0, 3.5, 'CDC NHANES', 2020),
  
  -- Female measurements
  ('female', 'US', 'shoulder', 40.0, 3.5, 'CDC NHANES', 2020),
  ('female', 'US', 'chest', 100.0, 12.0, 'CDC NHANES', 2020),
  ('female', 'US', 'waist', 95.0, 14.0, 'CDC NHANES', 2020),
  ('female', 'US', 'hips', 108.0, 12.0, 'CDC NHANES', 2020),
  ('female', 'US', 'neck', 34.0, 2.5, 'CDC NHANES', 2020),
  ('female', 'US', 'bicep', 31.0, 4.0, 'CDC NHANES', 2020),
  ('female', 'US', 'thigh', 60.0, 7.0, 'CDC NHANES', 2020),
  ('female', 'US', 'calf', 37.0, 3.5, 'CDC NHANES', 2020)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 8. HELPER FUNCTIONS (Optional)
-- =====================================================

-- Function to calculate percentile for a given measurement
CREATE OR REPLACE FUNCTION calculate_percentile(
  p_measurement_value DECIMAL,
  p_measurement_name TEXT,
  p_gender TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_mean DECIMAL;
  v_std_dev DECIMAL;
  v_z_score DECIMAL;
  v_percentile INTEGER;
BEGIN
  -- Get population statistics
  SELECT mean_cm, std_dev_cm INTO v_mean, v_std_dev
  FROM public.population_stats
  WHERE measurement_name = p_measurement_name
    AND gender = p_gender
    AND region = 'US'
  LIMIT 1;
  
  -- If no stats found, return NULL
  IF v_mean IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate z-score
  v_z_score := (p_measurement_value - v_mean) / v_std_dev;
  
  -- Approximate percentile using z-score (simplified)
  -- For production, use a proper CDF function
  v_percentile := ROUND(50 + (v_z_score * 19.1));
  
  -- Clamp to 0-100
  IF v_percentile < 0 THEN v_percentile := 0; END IF;
  IF v_percentile > 100 THEN v_percentile := 100; END IF;
  
  RETURN v_percentile;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. VIEWS FOR ANALYTICS (Optional)
-- =====================================================

-- View: Recent measurements with fit concern counts
CREATE OR REPLACE VIEW public.measurements_with_concerns AS
SELECT 
  m.*,
  COUNT(fc.id) as concern_count,
  ARRAY_AGG(fc.area) FILTER (WHERE fc.severity = 'high') as high_severity_areas
FROM public.measurements m
LEFT JOIN public.fit_concerns fc ON m.id = fc.measurement_id
GROUP BY m.id;

-- View: Model comparison statistics
CREATE OR REPLACE VIEW public.model_performance AS
SELECT 
  model_name,
  COUNT(*) as total_scans,
  AVG(confidence) as avg_confidence,
  AVG(token_count) as avg_tokens,
  AVG(api_cost_usd) as avg_cost,
  SUM(api_cost_usd) as total_cost
FROM public.measurements
GROUP BY model_name;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify tables were created
SELECT 
  table_name, 
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN ('measurements', 'fit_concerns', 'population_stats', 'ab_test_comparisons')
ORDER BY table_name;
