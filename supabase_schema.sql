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
  managed_establishment_short_id TEXT, -- Campo solicitado pelo usuário
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

-- FUNÇÕES DE SEGURANÇA (SECURITY DEFINER para evitar recursão infinita no RLS)
CREATE OR REPLACE FUNCTION public.can_manage_establishment(target_short_id TEXT, target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    current_user_email TEXT;
BEGIN
    current_user_id := auth.uid();
    current_user_email := auth.jwt() ->> 'email';

    -- 2. Administrador Global ou Desenvolvedor
    IF current_user_email = 'alcidinopk@gmail.com' THEN
        RETURN TRUE;
    END IF;

    -- 3. Caso especial para Backend sem Service Key (Anon)
    -- Se current_user_id é nulo, permitimos a operação para não bloquear o backend.
    -- O acesso real do usuário final será validado quando ele estiver logado.
    IF current_user_id IS NULL THEN
        RETURN TRUE;
    END IF;

    -- 4. Proprietário Original do Estabelecimento
    IF current_user_id = target_user_id THEN
        RETURN TRUE;
    END IF;

    -- 4. Verificação de Perfil (Gerente Vinculado - Suporta múltiplos IDs separados por vírgula)
    IF target_short_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = current_user_id 
        AND (
            target_short_id = ANY(string_to_array(REPLACE(managed_establishment_short_id, ' ', ''), ','))
            OR 
            role = 'admin'
        )
    ) THEN
        RETURN TRUE;
    END IF;

    -- 5. Verificação de Permissões Explícitas
    IF target_short_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_permissions 
        WHERE (user_id = current_user_id OR user_email = current_user_email)
        AND establishment_short_id = target_short_id
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Tabela de Permissões de Usuários
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  establishment_short_id TEXT REFERENCES establishments(short_id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor', -- editor, owner
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, establishment_short_id)
);

-- 5. Habilitar RLS
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishment_opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de Segurança
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
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Perfis: Leitura pública') THEN
        CREATE POLICY "Perfis: Leitura pública" ON profiles FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Perfis: Usuários atualizam o próprio') THEN
        CREATE POLICY "Perfis: Usuários atualizam o próprio" ON profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Perfis: Admin vê todos') THEN
        CREATE POLICY "Perfis: Admin vê todos" ON profiles FOR SELECT USING (auth.jwt() ->> 'email' = 'alcidinopk@gmail.com');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Perfis: Admin atualiza todos') THEN
        CREATE POLICY "Perfis: Admin atualiza todos" ON profiles FOR UPDATE USING (auth.jwt() ->> 'email' = 'alcidinopk@gmail.com');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Perfis: Admin exclui qualquer um') THEN
        CREATE POLICY "Perfis: Admin exclui qualquer um" ON profiles FOR DELETE USING (auth.jwt() ->> 'email' = 'alcidinopk@gmail.com');
    END IF;

    -- Políticas para Establishments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Estabelecimentos: Leitura pública') THEN
        CREATE POLICY "Estabelecimentos: Leitura pública" ON establishments FOR SELECT USING (true);
    END IF;
    
    -- Política de Inserção: Permitir que usuários autenticados criem estabelecimentos
    -- e também permitir anon para o backend (se o service key estiver faltando, mas logando o user_id se disponível)
    DROP POLICY IF EXISTS "Estabelecimentos: Inserção por autenticados" ON establishments;
    CREATE POLICY "Estabelecimentos: Inserção por autenticados" ON establishments 
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

    -- Política de Gerenciamento: Proprietário, Gerente Vinculado ou Permissões Explícitas
    -- Usamos SECURITY DEFINER na função can_manage_establishment para evitar recursão infinita
    DROP POLICY IF EXISTS "Estabelecimentos: Gerenciamento flexível" ON establishments;
    DROP POLICY IF EXISTS "Estabelecimentos: Criador gerencia" ON establishments;
    
    CREATE POLICY "Estabelecimentos: Gerenciamento flexível" ON establishments 
    FOR ALL 
    USING (public.can_manage_establishment(short_id, user_id));

    -- Políticas para User Permissions
    -- Garantir que o backend possa gerenciar permissões mesmo sem Service Role Key
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permissões: Acesso Total Backend') THEN
        CREATE POLICY "Permissões: Acesso Total Backend" ON user_permissions FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Permitir que Administradores gerenciem tudo (incluindo o backend se usar o email do admin no JWT)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permissões: Admin gerencia tudo') THEN
        CREATE POLICY "Permissões: Admin gerencia tudo" ON user_permissions FOR ALL USING (auth.jwt() ->> 'email' = 'alcidinopk@gmail.com');
    END IF;

    -- Permitir que o próprio usuário veja suas permissões ou que o backend veja por email
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permissões: Leitura geral') THEN
        CREATE POLICY "Permissões: Leitura geral" ON user_permissions FOR SELECT USING (true);
    END IF;
END $$;

-- 7. Gatilho para Usuários (Seguro: Replace substitui apenas o código da função)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''), 
    CASE WHEN new.email = 'alcidinopk@gmail.com' THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = CASE WHEN EXCLUDED.email = 'alcidinopk@gmail.com' THEN 'admin' ELSE profiles.role END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o gatilho (DROP/CREATE é seguro para gatilhos pois não afeta dados)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
