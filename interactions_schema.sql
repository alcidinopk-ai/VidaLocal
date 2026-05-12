-- SQL para criar a tabela de interações no Supabase

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  establishment_id TEXT NOT NULL, -- Pode ser UUID ou o ID mock (e1, p2, etc)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('avaliar', 'reclamar', 'indicar', 'comentar')),
  content TEXT NOT NULL,
  rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
-- Leitura pública para todos
CREATE POLICY "Leitura pública de interações" ON interactions
  FOR SELECT USING (true);

-- Inserção por usuários autenticados
CREATE POLICY "Inserção por usuários autenticados" ON interactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Permitir que o autor delete sua própria interação
CREATE POLICY "Autores podem deletar suas interações" ON interactions
  FOR DELETE USING (auth.uid() = user_id);

-- Permitir que administradores façam tudo
CREATE POLICY "Admins têm acesso total a interações" ON interactions
  FOR ALL USING (
    auth.jwt() ->> 'email' = 'alcidinopk@gmail.com'
  );
