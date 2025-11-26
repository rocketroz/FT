-- FitTwin Supabase Setup Script
-- Version 1.0
-- This script reconstructs the database schema based on the application code.

--
-- 1. STORAGE BUCKETS
-- Create a bucket for user scans, with public access for easy viewing.
--
INSERT INTO storage.buckets (id, name, public)
VALUES ('scans', 'scans', TRUE)
ON CONFLICT (id) DO NOTHING;

--
-- 2. ENUMS
-- Create a custom type for gender to ensure data consistency.
--
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
        CREATE TYPE gender_enum AS ENUM ('Male', 'Female', 'Other');
    END IF;
END$$;

--
-- 3. MEASUREMENTS TABLE
-- This is the core table for storing all scan results.
--
CREATE TABLE IF NOT EXISTS public.measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- User-provided stats
    height NUMERIC,
    weight NUMERIC,
    age INT,
    gender gender_enum,

    -- Core AI measurements (in cm)
    chest NUMERIC,
    waist NUMERIC,
    hips NUMERIC,
    shoulder NUMERIC,
    neck NUMERIC,
    sleeve NUMERIC,
    inseam NUMERIC,

    -- AI metadata and confidence
    confidence NUMERIC,
    model_name TEXT,
    scaling_factor NUMERIC,
    estimated_height_cm NUMERIC,
    thought_summary TEXT,
    token_count INT,
    thinking_tokens INT,

    -- Full JSON backup for debugging and future-proofing
    full_json JSONB,
    landmarks_json JSONB
);

--
-- 4. MEASUREMENT IMAGES TABLE
-- Stores references to the images associated with each measurement.
--
CREATE TABLE IF NOT EXISTS public.measurement_images (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    measurement_id UUID REFERENCES public.measurements(id) ON DELETE CASCADE,
    view_type TEXT, -- e.g., 'front', 'side'
    public_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

--
-- 5. DEBUG LOGS TABLE
-- For application monitoring and debugging.
--
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    session_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    level TEXT, -- 'info', 'warn', 'error'
    message TEXT,
    data JSONB,
    device_info JSONB
);

--
-- 6. ROW LEVEL SECURITY (RLS)
-- Enable RLS for all tables.
--
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

--
-- 7. RLS POLICIES
-- Define rules for who can access and modify data.
--

-- Measurements Policies:
-- Users can view their own measurements.
CREATE POLICY "Allow users to view their own measurements"
ON public.measurements
FOR SELECT
USING (auth.uid() = user_id);

-- Anyone can insert a new measurement (for anonymous scans).
CREATE POLICY "Allow anyone to insert a measurement"
ON public.measurements
FOR INSERT
WITH CHECK (TRUE);

-- Measurement Images Policies:
-- Users can view images linked to measurements they have access to.
CREATE POLICY "Allow users to see images for their measurements"
ON public.measurement_images
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.measurements m
        WHERE m.id = measurement_id AND m.user_id = auth.uid()
    )
);

-- Anyone can insert a measurement image.
CREATE POLICY "Allow anyone to insert a measurement image"
ON public.measurement_images
FOR INSERT
WITH CHECK (TRUE);

-- Debug Logs Policies:
-- Allow any authenticated user to insert logs (to track issues).
-- NOTE: For stricter security, you might lock this down further.
CREATE POLICY "Allow authenticated users to insert logs"
ON public.debug_logs
FOR INSERT
TO authenticated
WITH CHECK (TRUE);

-- Storage Policies:
-- Allow anyone to upload to the 'scans' bucket.
-- The path is namespaced with `userId` in the code, providing some separation.
CREATE POLICY "Allow public uploads to scans bucket"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'scans');

-- Anyone can view files in the 'scans' bucket.
CREATE POLICY "Allow public reads from scans bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'scans');

--
-- End of Script
--
