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
  is_featured BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_premium BOOLEAN DEFAULT FALSE,
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

-- Cities (Example for Gurupi, Palmas and Araguaína)
INSERT INTO cities (state_id, name, slug, active, latitude, longitude, population)
SELECT id, 'Gurupi', 'gurupi', true, -11.7298, -49.0678, 87593
FROM states WHERE uf = 'TO'
ON CONFLICT DO NOTHING;

INSERT INTO cities (state_id, name, slug, active, latitude, longitude, population)
SELECT id, 'Palmas', 'palmas', true, -10.1844, -48.3336, 306296
FROM states WHERE uf = 'TO'
ON CONFLICT DO NOTHING;

INSERT INTO cities (state_id, name, slug, active, latitude, longitude, population)
SELECT id, 'Araguaína', 'araguaina', true, -7.1925, -48.2078, 183381
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
SELECT 'Supermercado Quartetto', 1, 'Supermercado / Mercado', 'Av. Goiás, 1800, Centro, Gurupi - TO', '6333154400', NULL, 4.7, 'approved', id, -11.7315, -49.0685, 'Qualidade e variedade no coração de Gurupi.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Drogaria Globo', 1, 'Farmácia', 'Av. Goiás, 1250, Centro, Gurupi - TO', '6333122030', NULL, 4.6, 'approved', id, -11.7275, -49.0665, 'Atendimento farmacêutico completo e preços competitivos.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Mercado Municipal de Gurupi', 1, 'Supermercado / Mercado', 'Av. Goiás, 1000, Centro, Gurupi - TO', '6333150000', NULL, 4.4, 'approved', id, -11.7255, -49.0645, 'Produtos regionais frescos e tradicionais.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Supermercado Campelo', 1, 'Supermercado / Mercado', 'Av. Maranhão, 2200, Centro, Gurupi - TO', '6333124400', NULL, 4.8, 'approved', id, -11.7335, -49.0705, 'Tradição em servir bem a família gurupiense.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Farmácia Biofórmula', 1, 'Farmácia', 'Av. Maranhão, 1300, Centro, Gurupi - TO', '6333121100', NULL, 4.9, 'approved', id, -11.7280, -49.0670, 'Manipulação e medicamentos com rigor técnico.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Açougue Central', 1, 'Açougue', 'Av. Maranhão, 1100, Centro, Gurupi - TO', '6333123300', NULL, 4.5, 'approved', id, -11.7265, -49.0655, 'Carnes frescas e selecionadas diariamente.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Hospital Unimed Gurupi', 3, 'Hospital / Clínica / UPA', 'Av. Pará, 2500, Gurupi - TO', '6333112000', NULL, 4.7, 'approved', id, -11.7345, -49.0735, 'Atendimento médico hospitalar de alta qualidade.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Drogaria Rosário', 1, 'Farmácia', 'Av. Pará, 1800, Centro, Gurupi - TO', '6333125500', NULL, 4.5, 'approved', id, -11.7310, -49.0695, 'Sua saúde em boas mãos com a Drogaria Rosário.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Supermercado Supercom', 1, 'Supermercado / Mercado', 'Av. Pará, 1200, Centro, Gurupi - TO', '6333126600', NULL, 4.3, 'approved', id, -11.7285, -49.0665, 'Preço baixo e economia para o seu dia a dia.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Farmácia do Trabalhador', 1, 'Farmácia', 'Av. Piauí, 1400, Centro, Gurupi - TO', '6333127700', NULL, 4.6, 'approved', id, -11.7295, -49.0685, 'Medicamentos éticos e genéricos com o melhor preço.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Mini Mercado Piauí', 1, 'Supermercado / Mercado', 'Av. Piauí, 1600, Centro, Gurupi - TO', '6333128800', NULL, 4.2, 'approved', id, -11.7305, -49.0695, 'Conveniência e rapidez nas suas compras.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Drogaria Popular', 1, 'Farmácia', 'Av. Mato Grosso, 1100, Centro, Gurupi - TO', '6333129900', NULL, 4.4, 'approved', id, -11.7275, -49.0655, 'Atendimento humanizado e variedade em perfumaria.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Mercearia Mato Grosso', 1, 'Supermercado / Mercado', 'Av. Mato Grosso, 1300, Centro, Gurupi - TO', '6333120011', NULL, 4.1, 'approved', id, -11.7285, -49.0665, 'Produtos de mercearia e utilidades domésticas.' FROM cities WHERE slug = 'gurupi' UNION ALL
-- Alimentação
SELECT 'Churrascaria do Gaúcho', 1, 'Restaurante', 'Av. Goiás, 2200, Centro, Gurupi - TO', '6333121515', NULL, 4.7, 'approved', id, -11.7330, -49.0695, 'O melhor rodízio de carnes de Gurupi.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Lanchonete do Ponto', 1, 'Lanchonete', 'Av. Maranhão, 1400, Centro, Gurupi - TO', '6333122525', NULL, 4.5, 'approved', id, -11.7285, -49.0675, 'Salgados fritos e assados na hora.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Pizzaria Di Napoli', 1, 'Pizzaria', 'Av. Pará, 1600, Centro, Gurupi - TO', '6333123535', NULL, 4.8, 'approved', id, -11.7305, -49.0685, 'Pizzas tradicionais com borda recheada.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Restaurante Sabor de Minas', 1, 'Restaurante', 'Av. Piauí, 1200, Centro, Gurupi - TO', '6333124545', NULL, 4.6, 'approved', id, -11.7275, -49.0665, 'Comida mineira autêntica no fogão a lenha.' FROM cities WHERE slug = 'gurupi' UNION ALL
-- Serviços Automotivos
SELECT 'Posto Petrobras', 6, 'Posto de Combustível', 'Av. Goiás, 2800, Gurupi - TO', '6333125656', NULL, 4.4, 'approved', id, -11.7380, -49.0720, 'Combustível de confiança e troca de óleo.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Oficina do Alemão', 6, 'Oficina / Centro Automotivo', 'Av. Maranhão, 2800, Setor Industrial, Gurupi - TO', '6333126767', NULL, 4.7, 'approved', id, -11.7370, -49.0740, 'Especialista em injeção eletrônica e mecânica geral.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Gurupi Autopeças', 6, 'Oficina / Centro Automotivo', 'Av. Pará, 3000, Gurupi - TO', '6333127878', NULL, 4.5, 'approved', id, -11.7420, -49.0780, 'Peças para veículos nacionais e importados.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Posto Ipiranga', 6, 'Posto de Combustível', 'Av. Piauí, 2000, Gurupi - TO', '6333128989', NULL, 4.3, 'approved', id, -11.7350, -49.0710, 'Conveniência AM/PM e combustível de qualidade.' FROM cities WHERE slug = 'gurupi' UNION ALL
-- Lazer e Bem-estar
SELECT 'Academia Corpo e Mente', 9, 'Clube / Academia / Quadra', 'Av. Goiás, 3200, Gurupi - TO', '6333129090', NULL, 4.8, 'approved', id, -11.7410, -49.0740, 'Musculação, funcional e artes marciais.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Parque Mutuca', 9, 'Parques', 'Av. Beira Rio, Gurupi - TO', NULL, NULL, 4.9, 'approved', id, -11.7300, -49.0600, 'O principal ponto de encontro e lazer de Gurupi.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Igreja Presbiteriana de Gurupi', 9, 'Igrejas / Templos / Comunidades Religiosas', 'Av. Maranhão, 1600, Centro, Gurupi - TO', '6333120101', NULL, 4.7, 'approved', id, -11.7305, -49.0685, 'Comunidade cristã reformada.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Clube da OAB Gurupi', 9, 'Clube / Academia / Quadra', 'Av. Mato Grosso, Gurupi - TO', NULL, NULL, 4.6, 'approved', id, -11.7450, -49.0800, 'Lazer e esportes para advogados e convidados.' FROM cities WHERE slug = 'gurupi' UNION ALL
-- Educação
SELECT 'Colégio Objetivo Gurupi', 10, 'Escola (infantil ao médio)', 'Av. Goiás, 1100, Centro, Gurupi - TO', '6333121212', NULL, 4.8, 'approved', id, -11.7270, -49.0660, 'Ensino de qualidade do infantil ao pré-vestibular.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Faculdade Unicamps', 10, 'Universidade / Instituto Federal', 'Av. Maranhão, 2000, Gurupi - TO', '6333122323', NULL, 4.5, 'approved', id, -11.7320, -49.0700, 'Cursos superiores e pós-graduação.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'Escola Estadual Costa e Silva', 10, 'Escola (infantil ao médio)', 'Av. Pará, Centro, Gurupi - TO', '6333123434', NULL, 4.3, 'approved', id, -11.7330, -49.0720, 'Educação pública tradicional em Gurupi.' FROM cities WHERE slug = 'gurupi' UNION ALL
SELECT 'CNA Inglês e Espanhol', 10, 'Escola de Idiomas', 'Av. Piauí, 1500, Centro, Gurupi - TO', '6333124545', NULL, 4.9, 'approved', id, -11.7300, -49.0690, 'Aprenda um novo idioma com metodologia dinâmica.' FROM cities WHERE slug = 'gurupi' UNION ALL
-- Palmas Establishments
SELECT 'Hospital Geral de Palmas (HGP)', 3, 'Hospital / Clínica / UPA', 'NS 01, Qd. 201 Sul, Palmas - TO', '6332187800', NULL, 4.2, 'approved', id, -10.1950, -48.3330, 'Principal hospital público do estado do Tocantins.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Capim Dourado Shopping', 12, 'Shopping / Loja de Departamento / Outlet', 'Qd. 107 Norte, NS 05, Palmas - TO', '6332129500', NULL, 4.7, 'approved', id, -10.1750, -48.3350, 'O maior shopping center do Tocantins com cinema e praça de alimentação.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'UFT - Campus Palmas', 10, 'Universidade / Instituto Federal', 'Qd. 109 Norte, Av. NS 15, Palmas - TO', '6332294400', NULL, 4.6, 'approved', id, -10.1780, -48.3600, 'Universidade Federal do Tocantins - Campus Universitário de Palmas.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Palácio Araguaia', 3, 'Prefeitura / Câmara / Secretarias', 'Praça dos Girassóis, Palmas - TO', NULL, NULL, 4.8, 'approved', id, -10.1840, -48.3330, 'Sede do Governo do Estado do Tocantins.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Supermercado Quartetto', 1, 'Supermercado / Mercado', 'Qd. 204 Sul, Av. LO 05, Palmas - TO', '6332154400', NULL, 4.5, 'approved', id, -10.1980, -48.3300, 'Rede de supermercados tocantinense com produtos de qualidade.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Praia da Graciosa', 9, 'Parques', 'Orla de Palmas, Palmas - TO', NULL, NULL, 4.7, 'approved', id, -10.1850, -48.3650, 'Principal ponto turístico e de lazer de Palmas às margens do Lago.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Palmas Shopping', 12, 'Shopping / Loja de Departamento / Outlet', 'Qd. 101 Sul, Av. LO 01, Palmas - TO', '6332212000', NULL, 4.5, 'approved', id, -10.1880, -48.3300, 'Shopping center tradicional no centro de Palmas.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Restaurante Cabana do Lago', 1, 'Restaurante', 'Qd. 103 Sul, Rua LO 01, Palmas - TO', '6332154321', NULL, 4.8, 'approved', id, -10.1860, -48.3310, 'Culinária regional e peixes do Tocantins.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Farmácia Pague Menos', 1, 'Farmácia', 'Av. JK, Qd. 104 Sul, Palmas - TO', '6332151010', NULL, 4.6, 'approved', id, -10.1830, -48.3340, 'Farmácia com grande variedade e atendimento 24h.' FROM cities WHERE slug = 'palmas' UNION ALL
SELECT 'Hotel Girassol Plaza', 1, 'Hospedagem (hotel, pousada, temporada)', 'Qd. 101 Norte, NS 01, Palmas - TO', '6332120700', NULL, 4.7, 'approved', id, -10.1760, -48.3320, 'Hotel de alto padrão no centro de Palmas.' FROM cities WHERE slug = 'palmas' UNION ALL
-- Araguaína Establishments
SELECT 'Hospital Regional de Araguaína', 3, 'Hospital / Clínica / UPA', 'Av. Dom Emanuel, Araguaína - TO', '6334112600', NULL, 4.0, 'approved', id, -7.1900, -48.2050, 'Atendimento hospitalar de referência no norte do estado.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'Via Lago', 9, 'Parques', 'Av. Via Lago, Araguaína - TO', NULL, NULL, 4.9, 'approved', id, -7.1850, -48.1950, 'Cartão postal de Araguaína, ideal para caminhadas e lazer.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'UFNT - Campus Araguaína', 10, 'Universidade / Instituto Federal', 'Rua Paraguai, Araguaína - TO', '6334165600', NULL, 4.5, 'approved', id, -7.1950, -48.2150, 'Universidade Federal do Norte do Tocantins.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'Araguaína Park Shopping', 12, 'Shopping / Loja de Departamento / Outlet', 'Av. Bernardo Sayão, Araguaína - TO', '6334115500', NULL, 4.6, 'approved', id, -7.2100, -48.2250, 'Shopping center com diversas lojas e opções de lazer.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'Supermercado Campelo', 1, 'Supermercado / Mercado', 'Av. Filadélfia, Araguaína - TO', '6334117000', NULL, 4.7, 'approved', id, -7.1880, -48.2020, 'Tradição e qualidade em supermercado em Araguaína.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'Rodoviária de Araguaína', 11, 'Transporte Público (ônibus)', 'Av. Filadélfia, Araguaína - TO', NULL, NULL, 4.1, 'approved', id, -7.1920, -48.2080, 'Terminal rodoviário de passageiros de Araguaína.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'Restaurante Tio Patinhas', 1, 'Restaurante', 'Av. Prefeito João de Sousa Lima, Araguaína - TO', '6334141234', NULL, 4.5, 'approved', id, -7.1890, -48.2060, 'Restaurante tradicional com buffet variado.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'Premier Hotel', 1, 'Hospedagem (hotel, pousada, temporada)', 'Av. Bernardo Sayão, Araguaína - TO', '6334113000', NULL, 4.6, 'approved', id, -7.2050, -48.2200, 'Conforto e praticidade para sua estadia em Araguaína.' FROM cities WHERE slug = 'araguaina' UNION ALL
SELECT 'Colégio Santa Cruz', 10, 'Escola (infantil ao médio)', 'Av. Dom Emanuel, Araguaína - TO', '6334114455', NULL, 4.8, 'approved', id, -7.1910, -48.2040, 'Instituição de ensino tradicional em Araguaína.' FROM cities WHERE slug = 'araguaina'
ON CONFLICT DO NOTHING;
