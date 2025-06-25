# Google OAuth Cloud Testing Setup Guide

This guide walks through setting up a cloud Supabase instance to test Google OAuth functionality, while preserving your local development setup.

## Environment Configuration Strategy

We've created a dual-environment approach:

- **`.env.local`** - Your original local Supabase configuration (preserved)
- **`.env.cloud`** - New cloud Supabase configuration for OAuth testing
- **Scripts** - Easy switching between configurations

## Setup Steps

### 1. Create Cloud Supabase Project

**👤 You need to do this:**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose organization and fill in:
   - **Name**: `nuxt-team-auth-oauth-test` (or similar)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to you
4. Wait for project creation (~2 minutes)

### 2. Get Project Credentials

**👤 You need to do this:**

1. In your new project dashboard, go to **Settings → API**
2. Copy these values:
   - **Project URL** (e.g., `https://abc123def.supabase.co`)
   - **anon public key** (starts with `eyJhbGci...`)
   - **service_role key** (starts with `eyJhbGci...`)

### 3. Configure Cloud Environment

**👤 You need to do this:**

1. Open `playground/.env.cloud`
2. Replace the placeholder values with your actual credentials:

```bash
# Replace these with your actual cloud project values
SUPABASE_URL=https://YOUR_ACTUAL_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your-actual-anon-key-here
SUPABASE_SERVICE_KEY=your-actual-service-role-key-here
```

### 4. Set Up Database Schema

**🤖 I can help with this:**

Once you have the cloud project set up, we need to:

1. Apply our database migrations to the cloud instance
2. Configure RLS policies
3. Set up the same database structure as local

### 5. Configure Google OAuth

**👤 You need to do this:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to **APIs & Services → Credentials**
5. Create **OAuth 2.0 Client ID**:
   - **Application type**: Web application
   - **Name**: `Nuxt Team Auth Test`
   - **Authorized redirect URIs**: 
     - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
6. Copy the **Client ID** and **Client Secret**

### 6. Configure Supabase OAuth

**👤 You need to do this:**

1. In your Supabase project dashboard, go to **Authentication → Providers**
2. Find **Google** and enable it
3. Enter your Google OAuth credentials:
   - **Client ID**: From step 5
   - **Client Secret**: From step 5
4. Save configuration

## Usage

### Switch to Cloud Configuration

```bash
cd playground
./scripts/use-cloud.sh
pnpm run dev
```

### Switch Back to Local Configuration

```bash
cd playground  
./scripts/use-local.sh
pnpm run dev
```

### Verify Current Configuration

```bash
cd playground
cat .env | grep SUPABASE_URL
```

## Testing Google OAuth

Once cloud setup is complete, you can test:

1. **Signup Flow**: 
   - Go to `http://localhost:3000/signup`
   - Enter team name
   - Click "Continue with Google"
   - Complete OAuth flow
   - Verify team creation

2. **Signin Flow**:
   - Go to `http://localhost:3000/signin` 
   - Click "Continue with Google"
   - Verify signin works

3. **Profile Integration**:
   - Check user avatar displays correctly
   - Verify name extraction from Google profile
   - Test team features work with OAuth users

## Troubleshooting

### Common Issues

1. **"OAuth not configured"** - Check Google OAuth setup in Supabase
2. **"Redirect URI mismatch"** - Verify redirect URI in Google Cloud Console
3. **"Project not found"** - Check SUPABASE_URL in .env.cloud
4. **"Invalid API key"** - Verify anon/service keys in .env.cloud

### Reset to Local

If anything goes wrong, easily reset:

```bash
cd playground
./scripts/use-local.sh
```

Your local development environment remains untouched!

## Next Steps

After successful setup:

1. ✅ Test Google OAuth signup with team creation
2. ✅ Test Google OAuth signin 
3. ✅ Test team invite system with OAuth users
4. ✅ Verify all existing team features work
5. ✅ Test profile avatar/name handling