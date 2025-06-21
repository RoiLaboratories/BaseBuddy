-- Create the user_profiles table
CREATE TABLE user_profiles (
    telegram_id TEXT PRIMARY KEY,
    telegram_username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create the wallets table for storing multiple wallets per user
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT NOT NULL REFERENCES user_profiles(telegram_id),
    address TEXT NOT NULL UNIQUE,
    name TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_telegram_username ON user_profiles(telegram_username);
CREATE INDEX idx_wallet_telegram_id ON wallets(telegram_id);
CREATE INDEX idx_wallet_address ON wallets(address);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatically updating the updated_at column
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles table
CREATE POLICY "Service role can perform all operations on user_profiles" ON user_profiles
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT
    USING (auth.uid()::text = telegram_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE
    USING (auth.uid()::text = telegram_id)
    WITH CHECK (auth.uid()::text = telegram_id);

-- Create policies for wallets table
CREATE POLICY "Service role can perform all operations on wallets" ON wallets
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view own wallets" ON wallets
    FOR SELECT
    USING (auth.uid()::text = telegram_id);

CREATE POLICY "Users can manage own wallets" ON wallets
    FOR ALL
    USING (auth.uid()::text = telegram_id)
    WITH CHECK (auth.uid()::text = telegram_id);

-- Create stored procedure for setting primary wallet
CREATE OR REPLACE FUNCTION set_primary_wallet(p_telegram_id TEXT, p_wallet_id UUID)
RETURNS VOID AS $$
BEGIN
    -- First, set all wallets for this user to not primary
    UPDATE wallets 
    SET is_primary = false 
    WHERE telegram_id = p_telegram_id;
    
    -- Then set the specified wallet as primary
    UPDATE wallets 
    SET is_primary = true 
    WHERE id = p_wallet_id AND telegram_id = p_telegram_id;
END;
$$ LANGUAGE plpgsql;
