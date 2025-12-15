# Supabase Setup Guide for AuthentiqC

This guide will walk you through setting up Supabase as the backend for AuthentiqC.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js 20+ installed locally
- The AuthentiqC repository cloned

## Step-by-Step Setup

### Step 1: Create a New Supabase Project

1. Go to https://app.supabase.com
2. Click **"New Project"**
3. Fill in the project details:
   - **Name**: `authentiqc` (or your preferred name)
   - **Database Password**: Choose a strong password (save this securely)
   - **Region**: Choose the region closest to your users
   - **Pricing Plan**: Free tier is sufficient for development
4. Click **"Create new project"**
5. Wait 2-3 minutes for the project to be provisioned

### Step 2: Run the Database Setup SQL

1. In your Supabase project dashboard, navigate to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `SUPABASE_SETUP.sql` from this repository
4. Paste it into the SQL editor
5. Click **"Run"** (or press Ctrl/Cmd + Enter)
6. You should see a success message: "Success. No rows returned"

This SQL script creates:
- All necessary tables (profiles, products, qc_batches, qc_reports, images)
- Indexes for performance
- Row Level Security (RLS) policies
- A function for account deletion
- Triggers for automatic timestamp updates

### Step 3: Create the Storage Bucket

1. In your Supabase dashboard, navigate to **Storage** (left sidebar)
2. Click **"Create a new bucket"**
3. Enter the following details:
   - **Name**: `images` (must be exactly this name)
   - **Public bucket**: ✅ Check this box (so images can be accessed via public URLs)
   - **File size limit**: 50 MB (or adjust as needed)
   - **Allowed MIME types**: Leave empty to allow all image types
4. Click **"Create bucket"**

### Step 4: Configure Storage Policies

After creating the bucket, you need to set up policies to allow authenticated users to manage their own images.

1. Stay in the **Storage** section
2. Click on the **"images"** bucket
3. Click on the **"Policies"** tab
4. Click **"New Policy"**

Create the following policies:

#### Policy 1: Allow authenticated users to upload images

- **Policy name**: `Users can upload own images`
- **Policy definition**: Choose "Create a policy from scratch"
- **Allowed operation**: INSERT
- **Target roles**: authenticated
- **USING expression**:
  ```sql
  (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1])
  ```
- **WITH CHECK expression**: (same as above)
  ```sql
  (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1])
  ```

#### Policy 2: Allow authenticated users to view their own images

- **Policy name**: `Users can view own images`
- **Allowed operation**: SELECT
- **Target roles**: authenticated
- **USING expression**:
  ```sql
  (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1])
  ```

#### Policy 3: Allow authenticated users to update their own images

- **Policy name**: `Users can update own images`
- **Allowed operation**: UPDATE
- **Target roles**: authenticated
- **USING expression**:
  ```sql
  (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1])
  ```

#### Policy 4: Allow authenticated users to delete their own images

- **Policy name**: `Users can delete own images`
- **Allowed operation**: DELETE
- **Target roles**: authenticated
- **USING expression**:
  ```sql
  (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1])
  ```

**Alternative: Quick Policy Setup**

If you prefer, you can create these policies via SQL:

1. Go to **SQL Editor**
2. Run this SQL:

```sql
-- Storage policies for images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for uploading
CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for viewing
CREATE POLICY "Users can view own images"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for updating
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for deleting
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Step 5: Get Your Supabase Credentials

1. In your Supabase dashboard, click on the **Settings** icon (gear icon) in the left sidebar
2. Navigate to **API** section
3. You will see two important values:
   - **Project URL**: Something like `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: A long JWT token starting with `eyJ...`

**Important**: Keep these credentials secure! Never commit them to Git.

### Step 6: Configure Local Environment Variables

1. In the root of the AuthentiqC repository, create a `.env.local` file in the `pages` directory:
   ```bash
   cd pages
   touch .env.local
   ```

2. Add your Supabase credentials to `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. Also add your Gemini API key (required for AI features):
   ```env
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

4. (Optional) Add image proxy URL if you have deployed the Cloudflare Worker:
   ```env
   VITE_IMAGE_PROXY_URL=https://your-worker.workers.dev
   ```

**Full `.env.local` example:**
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://gbsgkvmjtsjpmjrpupma.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic2drdm1qdHNqcG1qcnB1cG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUwOTQ4MjQsImV4cCI6MjA4MDY3MDgyNH0.GYsoEO8qJXOsiOjK2QHYMOOI0OFAdc9KqX1SA-Z-3ac

# Gemini API (can also be set at login time in the app)
GEMINI_API_KEY=your-api-key-here

# Image Proxy Worker (optional, for fetching images from product URLs)
VITE_IMAGE_PROXY_URL=https://authentiqc-worker.your-subdomain.workers.dev
```

### Step 7: Test the Connection

1. Start the development server:
   ```bash
   cd pages
   npm run dev
   ```

2. Open http://localhost:5173 in your browser

3. You should see the login/signup page

4. Try creating a new account:
   - Enter an email and password
   - Click "Create Account"
   - Check your email for a confirmation link (if email confirmation is enabled)
   - Or if auto-confirm is enabled, you'll be logged in immediately

5. Once logged in, you should be able to:
   - Add products
   - Upload images
   - Perform QC inspections

### Step 8: Configure Email Settings (Optional)

By default, Supabase requires email confirmation for new signups. You can configure this:

1. Go to **Authentication** → **Settings** in your Supabase dashboard
2. Under **Auth Providers**, click on **Email**
3. Toggle settings as needed:
   - **Enable email confirmations**: Turn OFF for easier testing (turn ON for production)
   - **Enable email change confirmations**: Recommended for security
   - **Secure email change**: Recommended for production

### Step 9: Deploy to Production

When deploying to Cloudflare Pages:

1. In your Cloudflare Pages project settings, add environment variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
   - `GEMINI_API_KEY`: Your Gemini API key
   - `VITE_IMAGE_PROXY_URL`: Your Cloudflare Worker URL

2. Or set them as GitHub secrets for GitHub Actions deployment:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add the same environment variables as secrets

## Troubleshooting

### "Supabase not configured" Error

- **Check**: Ensure `.env.local` exists in the `pages` directory
- **Check**: Verify the environment variables are correctly named (with `VITE_` prefix)
- **Fix**: Restart the development server after changing `.env.local`

### "Bucket not found" Error

- **Check**: Ensure you created the `images` bucket in Storage
- **Check**: Verify the bucket name is exactly `images` (case-sensitive)

### "Permission denied" or "Row Level Security" Errors

- **Check**: Ensure you ran the complete SQL script including RLS policies
- **Check**: Verify storage policies are correctly configured
- **Fix**: Re-run the storage policy SQL commands

### Images Not Uploading

- **Check**: Ensure storage policies are set up correctly
- **Check**: Verify the bucket is set to "public"
- **Check**: Check browser console for specific error messages

### Email Confirmation Not Working

- **Check**: Verify email provider is configured in Supabase Authentication settings
- **Quick Fix**: Disable email confirmation for testing (not recommended for production)

## Security Best Practices

1. **Never commit credentials**: Always use `.env.local` for local development
2. **Use environment variables**: For production, use Cloudflare Pages environment variables or GitHub secrets
3. **Enable RLS**: Row Level Security is enabled by this setup script
4. **Regular backups**: Set up automated backups in Supabase dashboard
5. **Monitor usage**: Check Supabase dashboard for unusual activity

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Guide](https://supabase.com/docs/guides/storage)

## Need Help?

If you encounter issues:
1. Check the browser console for error messages
2. Check Supabase logs in the dashboard (Logs & Analytics)
3. Review this guide step by step
4. Check the existing issues in the GitHub repository
