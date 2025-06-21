# Supabase Migrations

This directory contains database migrations for the BaseBuddy Telegram bot.

## Initial Setup

1. Create a new Supabase project at https://supabase.com
2. Get your project URL and anon key from the project settings
3. Copy these values to your `.env` file:
   ```
   SUPABASE_URL=your_project_url
   SUPABASE_KEY=your_project_anon_key
   ```

## Running Migrations

1. Install the Supabase CLI if you haven't already:
   ```powershell
   scoop install supabase
   # or
   winget install Supabase.CLI
   ```

2. Link your project (replace PROJECT_ID with your Supabase project ID):
   ```powershell
   supabase link --project-ref PROJECT_ID
   ```

3. Run the migrations:
   ```powershell
   supabase db push
   ```

## Schema Overview

The initial migration (`20250606000000_init.sql`) creates:

- `user_profiles` table with columns:
  - `telegram_id` (Primary Key)
  - `telegram_username` (Unique)
  - `wallet_address`
  - `created_at`
  - `updated_at`

- Indexes for performance:
  - `idx_telegram_username`
  - `idx_wallet_address`

- Automatic timestamp updates:
  - `updated_at` is automatically updated on record changes

- Row Level Security (RLS) policies:
  - Service role has full access
  - Users can only view and update their own profiles

## Manual Setup

If you prefer to set up the schema manually, you can copy the SQL from `20250606000000_init.sql` and run it in the Supabase SQL editor.
