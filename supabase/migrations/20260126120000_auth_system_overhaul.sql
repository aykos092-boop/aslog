-- =====================================================
-- Production Auth System Migration
-- Email OTP, Google OAuth, Phone, Password Reset
-- =====================================================

-- 1. Email OTP Codes Table
CREATE TABLE IF NOT EXISTS email_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'email_verification', -- email_verification, login
  verified BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_email_otp_email ON email_otp_codes(email);
CREATE INDEX idx_email_otp_code ON email_otp_codes(code);
CREATE INDEX idx_email_otp_expires ON email_otp_codes(expires_at);
CREATE INDEX idx_email_otp_verified ON email_otp_codes(verified);

-- 2. Auth Attempts (Brute Force Protection)
CREATE TABLE IF NOT EXISTS auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- email or phone
  attempt_type TEXT NOT NULL, -- login, otp_verify, password_reset
  success BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_attempts_identifier ON auth_attempts(identifier);
CREATE INDEX idx_auth_attempts_created ON auth_attempts(created_at);

-- 3. OAuth Providers
CREATE TABLE IF NOT EXISTS oauth_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- google, facebook, etc.
  provider_user_id TEXT NOT NULL,
  email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_user_id ON oauth_providers(user_id);
CREATE INDEX idx_oauth_provider ON oauth_providers(provider);

-- 4. Enhance existing password_reset_tokens if not exists
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);

-- 5. Security Events Enhancement
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events') THEN
    CREATE TABLE security_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      severity TEXT DEFAULT 'info', -- info, warning, critical
      description TEXT,
      ip_address TEXT,
      user_agent TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);

-- 6. Account Lockout Table
CREATE TABLE IF NOT EXISTS account_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL UNIQUE, -- email or phone
  locked_until TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lockouts_identifier ON account_lockouts(identifier);
CREATE INDEX idx_lockouts_expires ON account_lockouts(locked_until);

-- 7. Email Verification Status
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active'; -- pending, active, suspended, blocked

-- 8. User Sessions for token management
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(refresh_token);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

-- 9. Rate Limiting Function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_attempts INT DEFAULT 5,
  p_window_minutes INT DEFAULT 60
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM auth_attempts
  WHERE identifier = p_identifier
    AND attempt_type = p_action
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  RETURN v_count < p_max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Cleanup Expired Tokens Function
CREATE OR REPLACE FUNCTION cleanup_expired_auth_tokens() RETURNS void AS $$
BEGIN
  -- Delete expired email OTP codes
  DELETE FROM email_otp_codes WHERE expires_at < NOW();
  
  -- Delete expired password reset tokens
  DELETE FROM password_reset_tokens WHERE expires_at < NOW();
  
  -- Delete old OTP codes (keep last 30 days)
  DELETE FROM otp_codes WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Delete expired account lockouts
  DELETE FROM account_lockouts WHERE locked_until < NOW();
  
  -- Delete expired sessions
  DELETE FROM user_sessions WHERE expires_at < NOW();
  
  -- Delete old auth attempts (keep last 90 days)
  DELETE FROM auth_attempts WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete old security events (keep last 1 year)
  DELETE FROM security_events WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Account Lockout Check Function
CREATE OR REPLACE FUNCTION is_account_locked(p_identifier TEXT) RETURNS BOOLEAN AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM account_lockouts
    WHERE identifier = p_identifier
      AND locked_until > NOW()
  ) INTO v_locked;
  
  RETURN v_locked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. RLS Policies
ALTER TABLE email_otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access email_otp" ON email_otp_codes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access auth_attempts" ON auth_attempts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access oauth" ON oauth_providers
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access reset_tokens" ON password_reset_tokens
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access lockouts" ON account_lockouts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access sessions" ON user_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own sessions
CREATE POLICY "Users view own sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can view their own OAuth providers
CREATE POLICY "Users view own oauth" ON oauth_providers
  FOR SELECT USING (auth.uid() = user_id);

-- 13. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_otp_updated_at BEFORE UPDATE ON email_otp_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_providers_updated_at BEFORE UPDATE ON oauth_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 14. Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

COMMENT ON TABLE email_otp_codes IS 'Email OTP codes for verification and 2FA';
COMMENT ON TABLE auth_attempts IS 'Track authentication attempts for security monitoring';
COMMENT ON TABLE oauth_providers IS 'OAuth provider integrations (Google, etc.)';
COMMENT ON TABLE account_lockouts IS 'Temporary account lockouts for security';
COMMENT ON TABLE user_sessions IS 'Active user sessions and refresh tokens';
