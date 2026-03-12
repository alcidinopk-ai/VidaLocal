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
  user_id UUID,
  rating DOUBLE PRECISION DEFAULT 5.0,
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
('Restaurante', true, 1),
('Lanchonete', true, 1),
('Pizzaria', true, 1),
('Padaria', true, 1),
('Açougue', true, 1),
('Hortifruti', true, 1),
('Supermercado', true, 1),
('Farmácia', true, 1),
('Hospital/Saúde', true, 1),
('Oficina Mecânica', true, 1),
('Pet Shop', true, 1),
('Salão de Beleza', true, 1),
('Academia', true, 1),
('Posto de Combustível', true, 1),
('Serviços Públicos', true, 2),
('Educação', true, 3),
('Social/Religioso', true, 3),
('Varejo/Compras', true, 3),
('Transporte Público', true, 2)
ON CONFLICT DO NOTHING;

-- Search Keywords (Comprehensive mapping for Intentional Search)
INSERT INTO search_keywords (intent_id, keyword, weight)
-- Restaurante
SELECT id, 'comer', 5 FROM search_intents WHERE name = 'Restaurante' UNION ALL
SELECT id, 'fome', 5 FROM search_intents WHERE name = 'Restaurante' UNION ALL
SELECT id, 'almoço', 5 FROM search_intents WHERE name = 'Restaurante' UNION ALL
SELECT id, 'jantar', 5 FROM search_intents WHERE name = 'Restaurante' UNION ALL
SELECT id, 'comida', 5 FROM search_intents WHERE name = 'Restaurante' UNION ALL
SELECT id, 'gastronomia', 3 FROM search_intents WHERE name = 'Restaurante' UNION ALL
-- Lanchonete
SELECT id, 'lanche', 5 FROM search_intents WHERE name = 'Lanchonete' UNION ALL
SELECT id, 'hamburguer', 5 FROM search_intents WHERE name = 'Lanchonete' UNION ALL
SELECT id, 'podrão', 5 FROM search_intents WHERE name = 'Lanchonete' UNION ALL
SELECT id, 'salgado', 5 FROM search_intents WHERE name = 'Lanchonete' UNION ALL
SELECT id, 'hot dog', 5 FROM search_intents WHERE name = 'Lanchonete' UNION ALL
-- Pizzaria
SELECT id, 'pizza', 5 FROM search_intents WHERE name = 'Pizzaria' UNION ALL
SELECT id, 'massa', 3 FROM search_intents WHERE name = 'Pizzaria' UNION ALL
SELECT id, 'italiana', 3 FROM search_intents WHERE name = 'Pizzaria' UNION ALL
-- Padaria
SELECT id, 'pão', 5 FROM search_intents WHERE name = 'Padaria' UNION ALL
SELECT id, 'café', 5 FROM search_intents WHERE name = 'Padaria' UNION ALL
SELECT id, 'bolo', 5 FROM search_intents WHERE name = 'Padaria' UNION ALL
SELECT id, 'doce', 5 FROM search_intents WHERE name = 'Padaria' UNION ALL
SELECT id, 'confeitaria', 3 FROM search_intents WHERE name = 'Padaria' UNION ALL
-- Açougue
SELECT id, 'carne', 5 FROM search_intents WHERE name = 'Açougue' UNION ALL
SELECT id, 'churrasco', 5 FROM search_intents WHERE name = 'Açougue' UNION ALL
SELECT id, 'picanha', 5 FROM search_intents WHERE name = 'Açougue' UNION ALL
SELECT id, 'frango', 5 FROM search_intents WHERE name = 'Açougue' UNION ALL
-- Hortifruti
SELECT id, 'fruta', 5 FROM search_intents WHERE name = 'Hortifruti' UNION ALL
SELECT id, 'verdura', 5 FROM search_intents WHERE name = 'Hortifruti' UNION ALL
SELECT id, 'legume', 5 FROM search_intents WHERE name = 'Hortifruti' UNION ALL
SELECT id, 'feira', 5 FROM search_intents WHERE name = 'Hortifruti' UNION ALL
SELECT id, 'sacolão', 5 FROM search_intents WHERE name = 'Hortifruti' UNION ALL
-- Farmácia
SELECT id, 'remedio', 5 FROM search_intents WHERE name = 'Farmácia' UNION ALL
SELECT id, 'dor', 5 FROM search_intents WHERE name = 'Farmácia' UNION ALL
SELECT id, 'saude', 5 FROM search_intents WHERE name = 'Farmácia' UNION ALL
SELECT id, 'drogaria', 5 FROM search_intents WHERE name = 'Farmácia' UNION ALL
SELECT id, 'medicamento', 5 FROM search_intents WHERE name = 'Farmácia' UNION ALL
-- Oficina
SELECT id, 'carro', 5 FROM search_intents WHERE name = 'Oficina Mecânica' UNION ALL
SELECT id, 'conserto', 5 FROM search_intents WHERE name = 'Oficina Mecânica' UNION ALL
SELECT id, 'mecanico', 5 FROM search_intents WHERE name = 'Oficina Mecânica' UNION ALL
SELECT id, 'pneu', 5 FROM search_intents WHERE name = 'Oficina Mecânica' UNION ALL
SELECT id, 'auto eletrica', 5 FROM search_intents WHERE name = 'Oficina Mecânica' UNION ALL
-- Pet Shop
SELECT id, 'cachorro', 5 FROM search_intents WHERE name = 'Pet Shop' UNION ALL
SELECT id, 'gato', 5 FROM search_intents WHERE name = 'Pet Shop' UNION ALL
SELECT id, 'ração', 5 FROM search_intents WHERE name = 'Pet Shop' UNION ALL
SELECT id, 'banho', 5 FROM search_intents WHERE name = 'Pet Shop' UNION ALL
SELECT id, 'veterinario', 5 FROM search_intents WHERE name = 'Pet Shop' UNION ALL
-- Posto
SELECT id, 'gasolina', 5 FROM search_intents WHERE name = 'Posto de Combustível' UNION ALL
SELECT id, 'etanol', 5 FROM search_intents WHERE name = 'Posto de Combustível' UNION ALL
SELECT id, 'diesel', 5 FROM search_intents WHERE name = 'Posto de Combustível' UNION ALL
SELECT id, 'combustivel', 5 FROM search_intents WHERE name = 'Posto de Combustível'
ON CONFLICT DO NOTHING;

-- Establishments (Seed Data)
INSERT INTO establishments (name, category_id, sub_category, address, phone, whatsapp, rating, status, city_id, latitude, longitude, description)
SELECT 'Espetinho do Adão B13', 1, 'Espetinho', 'Av. Goiás, 1438, Centro, Gurupi - TO', '6333121234', '63984551234', 4.8, 'approved', id, -11.7289, -49.0692, 'O melhor espetinho da região com acompanhamentos tradicionais.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Delicias da Polly', 1, 'Restaurante', 'Av. Maranhão, 1245, Centro, Gurupi - TO', '6333124455', '63992334455', 4.9, 'approved', id, -11.7275, -49.0660, 'Comida caseira, lanches e sobremesas feitas com carinho.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Mecânica do Neném', 6, 'Oficina / Centro Automotivo', 'Av. Maranhão, 2560, Setor Industrial, Gurupi - TO', '6333121122', '63984112233', 4.5, 'approved', id, -11.7350, -49.0720, 'Manutenção preventiva e corretiva para seu veículo com confiança.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Pet Shop Amigão', 5, 'Pet Shop (varejo)', 'Av. Goiás, 2100, Centro, Gurupi - TO', '6333128877', '63999887766', 4.7, 'approved', id, -11.7320, -49.0685, 'Tudo para o seu pet: rações, acessórios e banho e tosa.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Casa de Carnes Boi de Ouro', 1, 'Açougue', 'Av. Maranhão, 1500, Centro, Gurupi - TO', '6333124455', '63992113344', 4.9, 'approved', id, -11.7290, -49.0675, 'Carnes nobres e selecionadas para o seu churrasco.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Supermercado Beira Rio', 1, 'Supermercado / Mercado', 'Av. Goiás, 2500, Gurupi - TO', '6333131000', '6333131000', 4.5, 'approved', id, -11.7360, -49.0710, 'O melhor preço e variedade para sua casa.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Drogaria Ultra Popular', 1, 'Farmácia', 'Av. Goiás, 1100, Centro, Gurupi - TO', '6333122020', '6333122020', 4.7, 'approved', id, -11.7270, -49.0660, 'Farmácia com descontos reais em medicamentos.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Gurupi Net', 2, 'Provedor de Internet / Automação / Suporte TI', 'Rua 7, 1200, Centro, Gurupi - TO', '6333153000', '6333153000', 4.4, 'approved', id, -11.7300, -49.0680, 'Internet ultraveloz em fibra óptica para sua casa ou empresa.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Fórum de Gurupi', 3, 'Fórum / Tribunal', 'Av. Pará, Centro, Gurupi - TO', '6333112300', NULL, 4.2, 'approved', id, -11.7340, -49.0740, 'Comarca de Gurupi - Tribunal de Justiça do Estado do Tocantins.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT '4º Batalhão da Polícia Militar', 3, 'Delegacia / Polícia / Bombeiros', 'Av. Maranhão, Gurupi - TO', '6333121190', NULL, 4.8, 'approved', id, -11.7400, -49.0800, 'Segurança pública e policiamento ostensivo em Gurupi.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Barbearia Vip', 4, 'Salão de Beleza / Barbearia', 'Av. Goiás, 1800, Centro, Gurupi - TO', NULL, '63992008877', 4.9, 'approved', id, -11.7310, -49.0690, 'Corte moderno e ambiente climatizado para o homem de estilo.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Clínica Veterinária São Francisco', 5, 'Clínica Veterinária', 'Av. Maranhão, 2200, Gurupi - TO', '6333125566', NULL, 4.8, 'approved', id, -11.7330, -49.0700, 'Atendimento veterinário com amor e dedicação aos animais.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Posto Décio Gurupi', 6, 'Posto de Combustível', 'Rodovia BR-153, Gurupi - TO', '6333128800', NULL, 4.6, 'approved', id, -11.7500, -49.0900, 'Posto de serviços completo na BR-153.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Constrular Materiais de Construção', 7, 'Material de Construção / Ferragista', 'Av. Goiás, 3000, Gurupi - TO', '6333124400', NULL, 4.4, 'approved', id, -11.7400, -49.0750, 'Do alicerce ao acabamento, tudo para sua obra.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Imobiliária Terra', 8, 'Imobiliária / Corretor', 'Av. Maranhão, 1000, Centro, Gurupi - TO', '6333121010', NULL, 4.7, 'approved', id, -11.7260, -49.0650, 'Venda e aluguel de imóveis com transparência e segurança.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'UNIRG - Campus I', 10, 'Universidade / Instituto Federal', 'Av. Antônio Nunes da Silva, Gurupi - TO', '6333112700', NULL, 4.5, 'approved', id, -11.7450, -49.0600, 'Universidade de Gurupi - Ensino superior de excelência.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'IFTO - Campus Gurupi', 10, 'Universidade / Instituto Federal', 'Alameda Madrid, Gurupi - TO', '6333115400', NULL, 4.8, 'approved', id, -11.7600, -49.0500, 'Instituto Federal do Tocantins - Educação técnica e superior.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Ponto de Táxi Rodoviária', 11, 'Táxi / Motorista de Aplicativo', 'Rodoviária de Gurupi, Gurupi - TO', NULL, NULL, 4.3, 'approved', id, -11.7420, -49.0780, 'Serviço de táxi disponível 24h na rodoviária.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Lojas Novo Mundo', 12, 'Móveis / Eletrodomésticos / Eletrônicos', 'Av. Goiás, 1300, Centro, Gurupi - TO', '6333125050', NULL, 4.2, 'approved', id, -11.7280, -49.0670, 'Eletrodomésticos, móveis e tecnologia para sua casa.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Magazine Luiza', 12, 'Shopping / Loja de Departamento / Outlet', 'Av. Goiás, 1400, Centro, Gurupi - TO', '6333126060', NULL, 4.4, 'approved', id, -11.7290, -49.0680, 'Vem ser feliz no Magalu de Gurupi.' FROM cities WHERE slug = 'gurupi' UNION ALL
-- Palmas Establishments
SELECT 'Hospital Geral de Palmas (HGP)', 3, 'Hospital / Clínica / UPA', 'NS 01, Qd. 201 Sul, Palmas - TO', '6332187800', NULL, 4.2, 'approved', id, -10.1950, -48.3330, 'Principal hospital público do estado do Tocantins.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Capim Dourado Shopping', 12, 'Shopping / Loja de Departamento / Outlet', 'Qd. 107 Norte, NS 05, Palmas - TO', '6332129500', NULL, 4.7, 'approved', id, -10.1750, -48.3350, 'O maior shopping center do Tocantins com cinema e praça de alimentação.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'UFT - Campus Palmas', 10, 'Universidade / Instituto Federal', 'Qd. 109 Norte, Av. NS 15, Palmas - TO', '6332294400', NULL, 4.6, 'approved', id, -10.1780, -48.3600, 'Universidade Federal do Tocantins - Campus Universitário de Palmas.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Palácio Araguaia', 3, 'Prefeitura / Câmara / Secretarias', 'Praça dos Girassóis, Palmas - TO', NULL, NULL, 4.8, 'approved', id, -10.1840, -48.3330, 'Sede do Governo do Estado do Tocantins.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Supermercado Quartetto', 1, 'Supermercado / Mercado', 'Qd. 204 Sul, Av. LO 05, Palmas - TO', '6332154400', NULL, 4.5, 'approved', id, -10.1980, -48.3300, 'Rede de supermercados tocantinense com produtos de qualidade.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Praia da Graciosa', 9, 'Parques', 'Orla de Palmas, Palmas - TO', NULL, NULL, 4.7, 'approved', id, -10.1850, -48.3650, 'Principal ponto turístico e de lazer de Palmas às margens do Lago.' FROM cities WHERE slug = 'palmas' UNION ALL
-- Araguaína Establishments
SELECT 'Hospital Regional de Araguaína', 3, 'Hospital / Clínica / UPA', 'Av. Dom Emanuel, Araguaína - TO', '6334112600', NULL, 4.0, 'approved', id, -7.1900, -48.2050, 'Atendimento hospitalar de referência no norte do estado.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'Via Lago', 9, 'Parques', 'Av. Via Lago, Araguaína - TO', NULL, NULL, 4.9, 'approved', id, -7.1850, -48.1950, 'Cartão postal de Araguaína, ideal para caminhadas e lazer.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'UFNT - Campus Araguaína', 10, 'Universidade / Instituto Federal', 'Rua Paraguai, Araguaína - TO', '6334165600', NULL, 4.5, 'approved', id, -7.1950, -48.2150, 'Universidade Federal do Norte do Tocantins.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'Araguaína Park Shopping', 12, 'Shopping / Loja de Departamento / Outlet', 'Av. Bernardo Sayão, Araguaína - TO', '6334115500', NULL, 4.6, 'approved', id, -7.2100, -48.2250, 'Shopping center com diversas lojas e opções de lazer.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'Supermercado Campelo', 1, 'Supermercado / Mercado', 'Av. Filadélfia, Araguaína - TO', '6334117000', NULL, 4.7, 'approved', id, -7.1880, -48.2020, 'Tradição e qualidade em supermercado em Araguaína.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'Rodoviária de Araguaína', 11, 'Transporte Público (ônibus)', 'Av. Filadélfia, Araguaína - TO', NULL, NULL, 4.1, 'approved', id, -7.1920, -48.2080, 'Terminal rodoviário de passageiros de Araguaína.' FROM cities WHERE slug = 'araguaina'
ON CONFLICT DO NOTHING;
