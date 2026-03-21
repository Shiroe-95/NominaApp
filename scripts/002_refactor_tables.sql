-- NóminaSmart Refactor Migration: 002
-- Creates user_profiles, ai_providers, ai_usage_logs tables
-- Includes constraints, indexes, trigger, RLS policies and pgcrypto extension

-- ============================================================================
-- 0. Enable pgcrypto extension (for API key encryption)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. Table: user_profiles — Perfiles de usuario con rol
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role VARCHAR(20) NOT NULL DEFAULT 'client',
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'analyst', 'client'))
);

-- Indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON public.user_profiles(company_id);

-- ============================================================================
-- 2. Table: ai_providers — Configuración de proveedores de IA
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_type VARCHAR(20) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMP WITH TIME ZONE,
  last_test_success BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_provider_type CHECK (provider_type IN ('openai', 'anthropic', 'groq', 'google', 'openrouter'))
);

-- Indexes for ai_providers
CREATE INDEX IF NOT EXISTS idx_ai_providers_user_id ON public.ai_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_providers_provider_type ON public.ai_providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_ai_providers_priority ON public.ai_providers(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_ai_providers_is_active ON public.ai_providers(is_active);

-- ============================================================================
-- 3. Table: ai_usage_logs — Registro de uso de IA
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  provider_type VARCHAR(20) NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  agent_name VARCHAR(50) NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  tokens_input INT NOT NULL DEFAULT 0,
  tokens_output INT NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  fallback_from VARCHAR(50),
  fallback_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ai_usage_logs
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider_id ON public.ai_usage_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider_type ON public.ai_usage_logs(provider_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_agent_name ON public.ai_usage_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_success ON public.ai_usage_logs(success);

-- ============================================================================
-- 4. Trigger: handle_new_user — Auto-create user profile on auth.users insert
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, role, display_name)
  VALUES (NEW.id, 'client', NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to allow re-running
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. Row Level Security (RLS) Policies
-- ============================================================================

-- user_profiles RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
CREATE POLICY "Admins can update all profiles" ON public.user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role can insert profiles" ON public.user_profiles;
CREATE POLICY "Service role can insert profiles" ON public.user_profiles
  FOR INSERT WITH CHECK (true);

-- ai_providers RLS
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own providers" ON public.ai_providers;
CREATE POLICY "Users can view own providers" ON public.ai_providers
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own providers" ON public.ai_providers;
CREATE POLICY "Users can insert own providers" ON public.ai_providers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own providers" ON public.ai_providers;
CREATE POLICY "Users can update own providers" ON public.ai_providers
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own providers" ON public.ai_providers;
CREATE POLICY "Users can delete own providers" ON public.ai_providers
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all providers" ON public.ai_providers;
CREATE POLICY "Admins can view all providers" ON public.ai_providers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- ai_usage_logs RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all usage logs" ON public.ai_usage_logs;
CREATE POLICY "Admins can view all usage logs" ON public.ai_usage_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert usage logs" ON public.ai_usage_logs;
CREATE POLICY "Authenticated users can insert usage logs" ON public.ai_usage_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users can view own usage logs" ON public.ai_usage_logs
  FOR SELECT USING (
    provider_id IN (
      SELECT id FROM public.ai_providers WHERE user_id = auth.uid()
    )
  );
