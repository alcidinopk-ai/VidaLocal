-- Migrations for VidaLocal

-- 1. States table
CREATE TABLE IF NOT EXISTS states (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  uf VARCHAR(2) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Cities table
CREATE TABLE IF NOT EXISTS cities (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  state_id BIGINT REFERENCES states(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  population INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Search Intents table
CREATE TABLE IF NOT EXISTS search_intents (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Search Keywords table
CREATE TABLE IF NOT EXISTS search_keywords (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  intent_id BIGINT REFERENCES search_intents(id),
  keyword TEXT NOT NULL,
  weight INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Intent Type Map table
CREATE TABLE IF NOT EXISTS intent_type_map (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  intent_id BIGINT REFERENCES search_intents(id),
  type TEXT NOT NULL,
  weight INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Establishments table (Main)
CREATE TABLE IF NOT EXISTS establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id INTEGER,
  sub_category TEXT,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  hours TEXT,
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  maps_link TEXT,
  city_id BIGINT REFERENCES cities(id),
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Seed Data (Optional but helpful for initial setup)
-- States
INSERT INTO states (name, uf) VALUES 
('Tocantins', 'TO'),
('Goiás', 'GO'),
('São Paulo', 'SP'),
('Rio de Janeiro', 'RJ'),
('Distrito Federal', 'DF')
ON CONFLICT (uf) DO NOTHING;

-- Cities (Example for Gurupi)
INSERT INTO cities (state_id, name, slug, active, latitude, longitude, population)
SELECT id, 'Gurupi', 'gurupi', true, -11.7298, -49.0678, 87593
FROM states WHERE uf = 'TO'
ON CONFLICT DO NOTHING;

-- Search Intents
INSERT INTO search_intents (name, active, priority) VALUES
('Alimentação', true, 1),
('Automotivo/Emergência', true, 1),
('Saúde/Médico', true, 1),
('Manutenção Residencial', true, 2),
('Serviços Públicos', true, 2),
('Beleza', true, 3),
('Pets', true, 3),
('Educação', true, 3),
('Social/Religioso', true, 3),
('Varejo/Compras', true, 3),
('Transporte Público', true, 2),
('Entretenimento', true, 2)
ON CONFLICT DO NOTHING;
