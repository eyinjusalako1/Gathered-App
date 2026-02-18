# 🔧 Vercel Environment Variables Setup

## ⚠️ Critical: Fix "Failed to fetch" Login Error

If you're seeing a "Failed to fetch" error when trying to log in, it means your Supabase environment variables are not configured in Vercel.

## Quick Fix Steps

### 1. Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (the long JWT token)

### 2. Add Environment Variables in Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (`gathered`)
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

#### Required Variables:

```
NEXT_PUBLIC_SUPABASE_URL
```
- **Value**: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- **Environment**: Production, Preview, Development (select all)

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
- **Value**: Your Supabase anon public key (the long JWT token)
- **Environment**: Production, Preview, Development (select all)

#### Optional (for server-side operations):

```
SUPABASE_SERVICE_ROLE_KEY
```
- **Value**: Your Supabase service_role key (from Settings → API → service_role secret)
- **Environment**: Production, Preview, Development (select all)
- **⚠️ Warning**: Keep this secret! Never expose in frontend code.

### 3. Redeploy Your Application

After adding the environment variables:

1. Go to **Deployments** tab in Vercel
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger automatic redeployment

### 4. Verify the Fix

1. Visit your production URL: https://gathered-orpin.vercel.app
2. Try logging in again
3. The "Failed to fetch" error should be resolved

## 🔍 How to Verify Environment Variables Are Set

You can check if variables are set by:

1. **In Vercel Dashboard**: Settings → Environment Variables (should show your variables)
2. **In Browser Console**: 
   ```javascript
   // This should NOT be 'undefined' or 'https://placeholder.supabase.co'
   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
   ```

## 📝 Example Environment Variables

Here's what your Vercel environment variables should look like:

```
NEXT_PUBLIC_SUPABASE_URL=https://tkhbdtfljxkhgeccqnpq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGJkdGZsanhraGdlY2NxbnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUwNzY4MDAsImV4cCI6MjA1MDY1MjgwMH0.xxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGJkdGZsanhraGdlY2NxbnBxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTA3NjgwMCwiZXhwIjoyMDUwNjUyODAwfQ.xxxxx
```

## 🚨 Common Issues

### Issue: "Failed to fetch" error persists
- **Solution**: Make sure you redeployed after adding environment variables
- **Solution**: Check that variables are set for the correct environment (Production/Preview/Development)

### Issue: Variables show as "undefined"
- **Solution**: Make sure variable names are exactly correct (case-sensitive)
- **Solution**: Ensure you selected all environments when adding the variable

### Issue: Can't find Supabase credentials
- **Solution**: Go to Supabase Dashboard → Settings → API
- **Solution**: Make sure you're looking at the correct project

## 📚 Additional Resources

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Getting Started](https://supabase.com/docs/guides/getting-started)
- [Supabase API Reference](https://supabase.com/docs/reference/javascript/introduction)

---

**After setting up environment variables and redeploying, your login should work!** ✅





