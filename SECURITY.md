# SECURITY NOTICE

The Supabase service role key has been exposed in the git history. Please take these steps immediately:

1. Go to your Supabase project dashboard
2. Navigate to Project Settings -> API
3. Click "Rotate Service Role Key"
4. Update your `.env` file with the new key
5. Update any deployment environments with the new key

**Important**: Never commit the `.env` file to version control. Always use `.env.example` as a template.
