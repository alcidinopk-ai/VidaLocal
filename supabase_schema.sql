-- SQL COMPLETO E SEGURO PARA O VIDALOCAL
-- Use este script para garantir que todas as tabelas e políticas existam sem apagar dados.

-- 1. Tabela de Interações (Comentários, Avaliações, etc)
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('avaliar', 'reclamar', 'indicar', 'comentar')),
  content TEXT NOT NULL,
  rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Perfis
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'user',
  full_name TEXT,
  city TEXT,
  state TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Horários (Mantendo a compatibilidade)
CREATE TABLE IF NOT EXISTS establishment_opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id TEXT NOT NULL, -- Alterado para TEXT para suportar IDs mock
  day_of_week INT NOT NULL,
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar RLS
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishment_opening_hours ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Segurança (Cria apenas se não existir - Nota: O Supabase pode dar erro se a política já existir, basta ignorar ou usar o editor visual)
DO $$ 
BEGIN
    -- Políticas para Interactions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Interactions: Leitura pública') THEN
        CREATE POLICY "Interactions: Leitura pública" ON interactions FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Interactions: Inserção por autenticados') THEN
        CREATE POLICY "Interactions: Inserção por autenticados" ON interactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    -- Políticas para Profiles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Perfis: Usuários vêm o próprio') THEN
        CREATE POLICY "Perfis: Usuários vêm o próprio" ON profiles FOR SELECT USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Perfis: Admin vê todos') THEN
        CREATE POLICY "Perfis: Admin vê todos" ON profiles FOR SELECT USING (auth.jwt() ->> 'email' = 'alcidinopk@gmail.com');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Perfis: Admin atualiza todos') THEN
        CREATE POLICY "Perfis: Admin atualiza todos" ON profiles FOR UPDATE USING (auth.jwt() ->> 'email' = 'alcidinopk@gmail.com');
    END IF;
END $$;

-- 6. Gatilho para Usuários (Seguro: Replace substitui apenas o código da função)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o gatilho (DROP/CREATE é seguro para gatilhos pois não afeta dados)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
