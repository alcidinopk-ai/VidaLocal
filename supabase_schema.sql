-- SQL para criar a tabela de horários de funcionamento no Supabase

-- 1. Criar a tabela
CREATE TABLE IF NOT EXISTS establishment_opening_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  establishment_id UUID REFERENCES establishments(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL, -- 0 (Domingo) a 6 (Sábado)
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  
  -- UNIQUE(establishment_id, day_of_week) removido para permitir múltiplos horários (ex: almoço)
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE establishment_opening_hours ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas de acesso
-- Permitir leitura pública
CREATE POLICY "Permitir leitura pública de horários" ON establishment_opening_hours
  FOR SELECT USING (true);

-- Permitir inserção por usuários autenticados
CREATE POLICY "Permitir inserção por usuários autenticados" ON establishment_opening_hours
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Permitir que o dono do estabelecimento atualize os horários
CREATE POLICY "Permitir que donos atualizem seus horários" ON establishment_opening_hours
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM establishments 
      WHERE id = establishment_opening_hours.establishment_id 
      AND user_id = auth.uid()
    )
  );

-- Permitir que o dono do estabelecimento delete os horários
CREATE POLICY "Permitir que donos deletem seus horários" ON establishment_opening_hours
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM establishments 
      WHERE id = establishment_opening_hours.establishment_id 
      AND user_id = auth.uid()
    )
  );

-- Permitir que administradores façam tudo (usando email hardcoded ou removendo se não houver tabela de usuários)
CREATE POLICY "Permitir acesso total a admins" ON establishment_opening_hours
  FOR ALL USING (
    auth.jwt() ->> 'email' = 'alcidinopk@gmail.com'
  );
