import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Force loading of environment variables at the start
const envResult = dotenv.config();
if (envResult.error) {
  console.error('Error loading .env file:', envResult.error);
}
console.log('Current working directory:', process.cwd());

console.log('DEBUG: Testing Supabase Configuration');
console.log('-------------------------------------');
console.log('Environment Variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'Missing');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'Found' : 'Missing');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('\nERROR: Missing required Supabase configuration!');
  console.error('Please check your .env file and ensure it contains:');
  console.error('SUPABASE_URL=your_project_url');
  console.error('SUPABASE_KEY=your_service_role_key');
  process.exit(1);
}

console.log('\nCreating Supabase client with:');
console.log('URL:', process.env.SUPABASE_URL);
console.log('Key:', process.env.SUPABASE_KEY ? '[FOUND]' : '[MISSING]');

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  try {
    console.log('\nTesting Supabase connection...');
    const { data, error } = await supabase.from('wallets').select('count(*)', { count: 'exact' });
    
    if (error) {
      console.error('\nConnection test failed!');
      console.error('Error:', error.message);
      return;
    }

    console.log('Connection successful! Table access verified.');
    console.log('Count result:', data);
  } catch (err) {
    console.error('\nUnexpected error during connection test:');
    console.error(err);
  }
}

testConnection();