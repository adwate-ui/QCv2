-- ============================================================================
-- AuthentiqC - Supabase Database Setup Script
-- ============================================================================
-- This script creates all necessary tables, storage buckets, policies,
-- and functions for the AuthentiqC application.
--
-- Run this in your Supabase SQL Editor:
-- https://app.supabase.com/project/_/sql
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Tables
-- ============================================================================

-- Profiles table: User profile information
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    gemini_api_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table: Product information
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile JSONB NOT NULL,
    created_at BIGINT NOT NULL,
    creation_settings JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- QC Batches table: Quality control inspection batches
CREATE TABLE IF NOT EXISTS public.qc_batches (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timestamp BIGINT NOT NULL,
    image_ids TEXT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QC Reports table: Quality control reports
CREATE TABLE IF NOT EXISTS public.qc_reports (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Images table: Image metadata (actual images stored in Storage)
CREATE TABLE IF NOT EXISTS public.images (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_qc_batches_product_id ON public.qc_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_qc_batches_user_id ON public.qc_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_qc_reports_product_id ON public.qc_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_qc_reports_user_id ON public.qc_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_images_user_id ON public.images(user_id);

-- ============================================================================
-- STEP 3: Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS Policies
-- ============================================================================

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile"
    ON public.profiles FOR DELETE
    USING (auth.uid() = id);

-- Products policies
DROP POLICY IF EXISTS "Users can view own products" ON public.products;
CREATE POLICY "Users can view own products"
    ON public.products FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
CREATE POLICY "Users can insert own products"
    ON public.products FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own products" ON public.products;
CREATE POLICY "Users can update own products"
    ON public.products FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own products" ON public.products;
CREATE POLICY "Users can delete own products"
    ON public.products FOR DELETE
    USING (auth.uid() = user_id);

-- QC Batches policies
DROP POLICY IF EXISTS "Users can view own qc_batches" ON public.qc_batches;
CREATE POLICY "Users can view own qc_batches"
    ON public.qc_batches FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own qc_batches" ON public.qc_batches;
CREATE POLICY "Users can insert own qc_batches"
    ON public.qc_batches FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own qc_batches" ON public.qc_batches;
CREATE POLICY "Users can update own qc_batches"
    ON public.qc_batches FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own qc_batches" ON public.qc_batches;
CREATE POLICY "Users can delete own qc_batches"
    ON public.qc_batches FOR DELETE
    USING (auth.uid() = user_id);

-- QC Reports policies
DROP POLICY IF EXISTS "Users can view own qc_reports" ON public.qc_reports;
CREATE POLICY "Users can view own qc_reports"
    ON public.qc_reports FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own qc_reports" ON public.qc_reports;
CREATE POLICY "Users can insert own qc_reports"
    ON public.qc_reports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own qc_reports" ON public.qc_reports;
CREATE POLICY "Users can update own qc_reports"
    ON public.qc_reports FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own qc_reports" ON public.qc_reports;
CREATE POLICY "Users can delete own qc_reports"
    ON public.qc_reports FOR DELETE
    USING (auth.uid() = user_id);

-- Images policies
DROP POLICY IF EXISTS "Users can view own images" ON public.images;
CREATE POLICY "Users can view own images"
    ON public.images FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own images" ON public.images;
CREATE POLICY "Users can insert own images"
    ON public.images FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own images" ON public.images;
CREATE POLICY "Users can update own images"
    ON public.images FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own images" ON public.images;
CREATE POLICY "Users can delete own images"
    ON public.images FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 5: Create Function for Account Deletion
-- ============================================================================

-- This function allows users to delete their own account and all associated data
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Get the current authenticated user's ID
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Delete in specific order to respect foreign key constraints
    -- The CASCADE clauses in the table definitions will handle most deletions,
    -- but we do this explicitly for clarity and control
    
    DELETE FROM public.qc_reports WHERE user_id = current_user_id;
    DELETE FROM public.qc_batches WHERE user_id = current_user_id;
    DELETE FROM public.images WHERE user_id = current_user_id;
    DELETE FROM public.products WHERE user_id = current_user_id;
    DELETE FROM public.profiles WHERE id = current_user_id;
    
    -- Note: This function does NOT delete the auth.users record
    -- That should be handled by calling supabase.auth.signOut() from the client
    -- The CASCADE on the auth.users FK will clean up any remaining data
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- ============================================================================
-- STEP 6: Create Triggers for Updated Timestamps
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger for profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- Trigger for products table
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- Trigger for qc_reports table
DROP TRIGGER IF EXISTS update_qc_reports_updated_at ON public.qc_reports;
CREATE TRIGGER update_qc_reports_updated_at
    BEFORE UPDATE ON public.qc_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- 
-- Next steps:
-- 1. Create a Storage bucket named "images" (see SUPABASE_SETUP_GUIDE.md)
-- 2. Configure storage policies for the "images" bucket
-- 3. Update your .env.local or environment variables with Supabase credentials
-- 
-- ============================================================================
