import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdmin } from "./src/lib/supabase-server.js";
import Fuse from "fuse.js";
import { CATEGORIES, SUB_CATEGORIES } from "./src/constants/taxonomy.js";

const TAXONOMY_CONTEXT = `
Abaixo está a taxonomia oficial do VidaLocal que você deve usar para categorizar estabelecimentos:
${CATEGORIES.map(c => `- Categoria: ${c.name} (ID: ${c.id})
  Tipos: ${SUB_CATEGORIES.filter(sc => sc.categoryId === c.id).map(sc => sc.name).join(", ")}`).join("\n")}
`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple in-memory cache
const apiCache = new Map<string, { data: any, expiry: number }>();
const cityIdCache = new Map<number, number[]>();
const CACHE_TTL = 60 * 1000; // 1 minute

const getCached = (key: string) => {
  const cached = apiCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
  return null;
};

const setCache = (key: string, data: any) => {
  apiCache.set(key, { data, expiry: Date.now() + CACHE_TTL });
};

const clearCache = () => {
  apiCache.clear();
  console.log('[Cache] API cache cleared due to data mutation');
};

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

async function resolveCityAndState(supabase: any, geo: any) {
  if (!geo || !geo.cityName || !geo.stateUf) return null;
  
  try {
    // 1. Resolve State
    const { data: stateData } = await supabase
      .from('states')
      .select('id')
      .eq('uf', geo.stateUf)
      .maybeSingle();
    
    if (!stateData) {
      console.warn(`[ResolveGeo] State ${geo.stateUf} not found.`);
      return null;
    }

    const stateId = stateData.id;
    
    // 2. Resolve or Create City
    const { data: cityData } = await supabase
      .from('cities')
      .select('id')
      .eq('state_id', stateId)
      .ilike('name', geo.cityName)
      .maybeSingle();
    
    if (cityData) {
      return { cityId: cityData.id, stateId };
    }

    // Create new city
    console.log(`[ResolveGeo] Creating new city: ${geo.cityName}`);
    const slug = geo.cityName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    const { data: newCity, error: createError } = await supabase
      .from('cities')
      .insert([{
        name: geo.cityName,
        state_id: stateId,
        slug: slug,
        active: true
      }])
      .select()
      .maybeSingle();
    
    if (!createError && newCity) {
      return { cityId: newCity.id, stateId };
    } else {
      console.error("[ResolveGeo] Failed to create city:", createError?.message);
      return null;
    }
  } catch (err: any) {
    console.error("[ResolveGeo] Unexpected error:", err.message);
    return null;
  }
}

// Check Supabase configuration on startup
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const isSupabaseConfigured = !!(supabaseUrl && 
                             supabaseKey && 
                             !supabaseUrl.includes('placeholder'));

console.log(`[Startup] Supabase basic check: ${isSupabaseConfigured}`);
console.log(`[Startup] Env: ${process.env.NODE_ENV || 'dev'}, Vercel: ${!!process.env.VERCEL}`);

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Auth callback is handled by the client-side React app in App.tsx
// to allow proper Supabase session exchange.

// Mock Data
const states = [
  { id: 1, name: "Tocantins", uf: "TO" },
  { id: 2, name: "Goiás", uf: "GO" },
  { id: 3, name: "São Paulo", uf: "SP" },
  { id: 4, name: "Rio de Janeiro", uf: "RJ" },
  { id: 5, name: "Distrito Federal", uf: "DF" },
];

const cities = [
  { id: 1, state_id: 1, name: "Gurupi", slug: "gurupi", active: true, latitude: -11.7298, longitude: -49.0678, population: 87593 },
  { id: 2, state_id: 1, name: "Palmas", slug: "palmas", active: true, latitude: -10.1844, longitude: -48.3336, population: 306296 },
  { id: 3, state_id: 1, name: "Araguaína", slug: "araguaina", active: true, latitude: -7.1925, longitude: -48.2078, population: 183381 },
  { id: 6, state_id: 1, name: "Porto Nacional", slug: "porto-nacional", active: true, latitude: -10.7081, longitude: -48.4172, population: 53316 },
  { id: 7, state_id: 1, name: "Paraíso do Tocantins", slug: "paraiso-do-tocantins", active: true, latitude: -10.1753, longitude: -48.8833, population: 52521 },
  { id: 8, state_id: 1, name: "Colinas do Tocantins", slug: "colinas-do-tocantins", active: true, latitude: -8.0558, longitude: -48.4764, population: 35857 },
  { id: 9, state_id: 1, name: "Araguatins", slug: "araguatins", active: true, latitude: -5.6503, longitude: -48.1250, population: 36170 },
  { id: 10, state_id: 1, name: "Guaraí", slug: "guarai", active: true, latitude: -8.8344, longitude: -48.5103, population: 26403 },
  { id: 11, state_id: 1, name: "Tocantinópolis", slug: "tocantinopolis", active: true, latitude: -6.3233, longitude: -47.4128, population: 22619 },
  { id: 12, state_id: 1, name: "Dianópolis", slug: "dianopolis", active: true, latitude: -11.6286, longitude: -46.8203, population: 22234 },
  { id: 13, state_id: 5, name: "Brasília", slug: "brasilia", active: true, latitude: -15.7801, longitude: -47.9292, population: 3015268 },
  { id: 4, state_id: 2, name: "Goiânia", slug: "goiania", active: true, latitude: -16.6869, longitude: -49.2648, population: 1536097 },
  { id: 5, state_id: 3, name: "São Paulo", slug: "sao-paulo", active: true, latitude: -23.5505, longitude: -46.6333, population: 12330000 },
];

interface Establishment {
  id: string;
  short_id?: string;
  name: string;
  category_id: number;
  sub_category: string;
  address: string;
  city_id: number;
  latitude: number;
  longitude: number;
  rating: number;
  whatsapp?: string;
  phone?: string;
  website?: string;
  hours?: string;
  is_open_24_hours?: boolean;
  description?: string;
  user_id?: string;
  status?: string;
  is_featured?: boolean;
  is_verified?: boolean;
  is_premium?: boolean;
  plus_code?: string;
  created_at?: string;
  images?: string[];
}

// Generate a random 6-character short ID (uppercase letters and numbers)
function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Permission checking helper
async function canUserEdit(supabase: any, userId: string, establishmentIdOrShortId: string): Promise<boolean> {
  console.log(`[Permissions] Checking edit permission for user ${userId} on establishment ${establishmentIdOrShortId}`);
  if (!userId) {
    console.warn('[Permissions] No userId provided');
    return false;
  }
  
  try {
    // 0. Check if user is admin (this bypasses everything else)
    // First check by ID in profiles
    const { data: profile } = await supabase.from('profiles').select('role, email').eq('id', userId).maybeSingle();
    if (profile?.role === 'admin' || profile?.email === 'alcidinopk@gmail.com') {
      console.log(`[Permissions] User ${userId} is an admin or developer (via profile). Permission granted.`);
      return true;
    }

    // Fallback: check Auth email directly (most reliable for developer account)
    const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUser(userId);
    if (!authError && authUser?.email === 'alcidinopk@gmail.com') {
      console.log(`[Permissions] User ${userId} is the developer (via auth email). Permission granted.`);
      return true;
    }

    // 1. Check if user is the creator (admin_id/user_id)
    // Separate queries to avoid potential type mismatch issues in .or() if using UUID vs String
    let establishment = null;
    
    // Try by short_id first (safest as it's always a string)
    const { data: byShortId } = await supabase
      .from('establishments')
      .select('user_id, short_id, id')
      .eq('short_id', establishmentIdOrShortId)
      .maybeSingle();
      
    establishment = byShortId;
    
    // If not found and looks like a UUID, try by id
    if (!establishment && establishmentIdOrShortId.length > 30) {
      const { data: byId } = await supabase
        .from('establishments')
        .select('user_id, short_id, id')
        .eq('id', establishmentIdOrShortId)
        .maybeSingle();
      establishment = byId;
    }

    if (!establishment) {
      console.warn(`[Permissions] Establishment ${establishmentIdOrShortId} not found in Supabase`);
      return false;
    }

    console.log(`[Permissions] Establishment found. Owner: ${establishment.user_id}, Checking against: ${userId}`);
    if (establishment.user_id === userId) return true;
    
    // 2. Check user_permissions table
    const { data: permission } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('establishment_short_id', establishment.short_id)
      .maybeSingle();
      
    if (permission) {
      console.log(`[Permissions] User ${userId} has explicit permission for ${establishment.short_id}`);
      return true;
    }

    console.warn(`[Permissions] User ${userId} does NOT have permission for ${establishment.short_id}`);
  } catch (err) {
    console.error('[Permissions] Error checking:', err);
  }
  
  return false;
}

let establishments: Establishment[] = [
  { id: "e1", name: "Espetinho do Adão B13", category_id: 1, sub_category: "Espetinho", address: "Av. Goiás, 1438, Centro, Gurupi - TO", city_id: 1, latitude: -11.7289, longitude: -49.0692, rating: 4.8, whatsapp: "63984551234", phone: "6333121234", description: "O melhor espetinho da região com acompanhamentos tradicionais.", status: 'approved', is_featured: true, is_verified: true, is_premium: true, images: ["https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80", "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&q=80"], hours: "Segunda-feira: 18:00-00:00\nTerça-feira: 18:00-00:00\nQuarta-feira: 18:00-00:00\nQuinta-feira: 18:00-00:00\nSexta-feira: 18:00-01:00\nSábado: 18:00-01:00\nDomingo: Fechado" },
  { id: "e2", name: "Delicias da Polly", category_id: 1, sub_category: "Lanchonete", address: "Rua 36 Qd. 92 Lt 24 N 310 Nova Fronteira, Gurupi - TO", city_id: 1, latitude: -11.7275, longitude: -49.0660, rating: 4.9, whatsapp: "63992334455", phone: "6333124455", description: "Comida caseira, lanches e sobremesas feitas com carinho.", status: 'approved', is_featured: true, is_verified: true, is_premium: true, images: ["https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80", "https://images.unsplash.com/photo-1476224483472-279815b0019e?w=800&q=80"], hours: "Segunda-feira: 11:00-14:30\nTerça-feira: 11:00-14:30\nQuarta-feira: 11:00-14:30\nQuinta-feira: 11:00-14:30\nSexta-feira: 11:00-14:30\nSábado: 11:00-15:00\nDomingo: 11:00-15:00" },
  { id: "e3", name: "Mecânica do Neném", category_id: 6, sub_category: "Oficina / Centro Automotivo", address: "Av. Maranhão, 2560, Setor Industrial, Gurupi - TO", city_id: 1, latitude: -11.7350, longitude: -49.0720, rating: 4.5, whatsapp: "63984112233", phone: "6333121122", description: "Manutenção preventiva e corretiva para seu veículo com confiança.", status: 'approved', images: ["https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80", "https://images.unsplash.com/photo-1487754164641-a09bd0ec07aa?w=800&q=80"] },
  { id: "e4", name: "Pet Shop Amigão", category_id: 5, sub_category: "Pet Shop (varejo)", address: "Av. Goiás, 2100, Centro, Gurupi - TO", city_id: 1, latitude: -11.7320, longitude: -49.0685, rating: 4.7, whatsapp: "63999887766", phone: "6333128877", description: "Tudo para o seu pet: rações, acessórios e banho e tosa.", status: 'approved', images: ["https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=800&q=80", "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&q=80"] },
  { id: "e5", name: "Pizzaria Bella Italia", category_id: 1, sub_category: "Pizzaria", address: "Av. Pará, 1500, Centro, Gurupi - TO", city_id: 1, latitude: -11.7295, longitude: -49.0670, rating: 4.6, whatsapp: "63992112233", phone: "6333129988", description: "Pizzas artesanais com massa fina e ingredientes selecionados.", status: 'approved', is_featured: true, is_verified: true, is_premium: true, images: ["https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80", "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80"], hours: "Aberto 24 horas" },
  { id: "e6", name: "Farmácia Preço Baixo", category_id: 1, sub_category: "Farmácia", address: "Rua 5, 800, Centro, Gurupi - TO", city_id: 1, latitude: -11.7310, longitude: -49.0695, rating: 4.4, whatsapp: "63992445566", phone: "6333127766", description: "Medicamentos e perfumaria com os melhores preços da cidade.", status: 'approved', images: ["https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=800&q=80"] },
  { id: "e7", name: "Supermercado Araguaia", category_id: 1, sub_category: "Supermercado / Mercado", address: "Av. Goiás, 1000, Centro, Gurupi - TO", city_id: 1, latitude: -11.7260, longitude: -49.0650, rating: 4.3, whatsapp: "63992556677", phone: "6333126655", description: "Variedade em hortifruti, açougue e mercearia para sua família.", status: 'approved', images: ["https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80"] },
  { id: "e8", name: "Barbearia do Zé", category_id: 4, sub_category: "Salão de Beleza / Barbearia", address: "Rua 3, 450, Centro, Gurupi - TO", city_id: 1, latitude: -11.7280, longitude: -49.0680, rating: 4.9, whatsapp: "63992667788", phone: "6333125544", description: "Corte de cabelo e barba com estilo e atendimento personalizado.", status: 'approved', is_featured: true, is_verified: true, is_premium: false, images: ["https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80", "https://images.unsplash.com/photo-1599351474290-288d848c3fdf?w=800&q=80"] },
  { id: "e9", name: "Clínica Veterinária Vida", category_id: 5, sub_category: "Clínica Veterinária", address: "Av. Maranhão, 3000, Gurupi - TO", city_id: 1, latitude: -11.7380, longitude: -49.0750, rating: 4.8, whatsapp: "63992778899", phone: "6333124433", description: "Cuidado completo para a saúde do seu animal de estimação.", status: 'approved' },
  { id: "e10", name: "Posto Central", category_id: 6, sub_category: "Posto de Combustível", address: "Av. Goiás, 500, Centro, Gurupi - TO", city_id: 1, latitude: -11.7250, longitude: -49.0640, rating: 4.2, whatsapp: "63992889900", phone: "6333123322", description: "Combustível de qualidade e conveniência 24 horas.", status: 'approved', images: ["https://images.unsplash.com/photo-1545147551-6d738f67e589?w=800&q=80"] },
  { id: "e11", name: "Concessionária de Água (Saneamento)", category_id: 1, sub_category: "Concessionária de Água", address: "Rua 1, Centro, Gurupi - TO", city_id: 1, latitude: -11.7255, longitude: -49.0655, rating: 4.0, phone: "6333150001", description: "Atendimento ao público para serviços de água e esgoto.", status: 'approved', images: ["https://images.unsplash.com/photo-1541888941255-20219669651c?w=800&q=80"] },
  { id: "e12", name: "Lanchonete Central", category_id: 1, sub_category: "Lanchonete", address: "Rua 4, 600, Centro, Gurupi - TO", city_id: 1, latitude: -11.7285, longitude: -49.0675, rating: 4.7, whatsapp: "63992001122", phone: "6333121100", description: "Salgados frescos, sucos naturais e o melhor café da manhã.", status: 'approved', images: ["https://images.unsplash.com/photo-1550507992-eb63ffee0847?w=800&q=80"] },
  { id: "e13", name: "Pizzaria do Vale", category_id: 1, sub_category: "Pizzaria", address: "Av. Pará, 2000, Gurupi - TO", city_id: 1, latitude: -11.7320, longitude: -49.0700, rating: 4.8, whatsapp: "63992112233", phone: "6333120099", description: "Pizzas no forno a lenha com bordas recheadas e muito sabor.", status: 'approved' },
  { id: "e14", name: "Hospital Regional de Gurupi", category_id: 3, sub_category: "Hospital / Clínica / UPA", address: "Av. Pará, S/N, Gurupi - TO", city_id: 1, latitude: -11.7350, longitude: -49.0750, rating: 4.1, whatsapp: "6333150200", phone: "6333150200", description: "Atendimento hospitalar de urgência e emergência para a região.", status: 'approved' },
  { id: "e15", name: "Prefeitura Municipal", category_id: 3, sub_category: "Prefeitura / Câmara / Secretarias", address: "Rua 1, Centro, Gurupi - TO", city_id: 1, latitude: -11.7250, longitude: -49.0650, rating: 4.0, whatsapp: "6333150000", phone: "6333150000", description: "Sede administrativa do poder executivo municipal de Gurupi.", status: 'approved' },
  { id: "e16", name: "Escola Municipal de Gurupi", category_id: 10, sub_category: "Escola (infantil ao médio)", address: "Rua 10, Centro, Gurupi - TO", city_id: 1, latitude: -11.7280, longitude: -49.0660, rating: 4.5, whatsapp: "6333151111", phone: "6333151111", description: "Educação de qualidade para crianças e jovens da nossa cidade.", status: 'approved' },
  { id: "e17", name: "Igreja Matriz de Gurupi", category_id: 9, sub_category: "Igrejas / Templos / Comunidades Religiosas", address: "Praça da Matriz, Centro, Gurupi - TO", city_id: 1, latitude: -11.7290, longitude: -49.0670, rating: 4.9, whatsapp: "6333152222", phone: "6333152222", description: "Comunidade religiosa acolhedora no coração de Gurupi.", status: 'approved' },
  { id: "e18", name: "Academia Fitness", category_id: 9, sub_category: "Clube / Academia / Quadra", address: "Av. Goiás, 1500, Centro, Gurupi - TO", city_id: 1, latitude: -11.7300, longitude: -49.0680, rating: 4.7, whatsapp: "63992113344", phone: "6333123344", description: "Equipamentos modernos e profissionais qualificados para seu treino.", status: 'approved' },
  { id: "e19", name: "Móveis Estrela", category_id: 12, sub_category: "Móveis / Eletrodomésticos / Eletrônicos", address: "Av. Maranhão, 1800, Centro, Gurupi - TO", city_id: 1, latitude: -11.7310, longitude: -49.0690, rating: 4.4, whatsapp: "63992224455", phone: "6333124455", description: "Móveis de qualidade para todos os ambientes da sua casa.", status: 'approved' },
  { id: "e20", name: "Moda Fashion", category_id: 12, sub_category: "Moda (feminina, masculina, infantil, fitness)", address: "Rua 5, 1000, Centro, Gurupi - TO", city_id: 1, latitude: -11.7320, longitude: -49.0700, rating: 4.6, whatsapp: "63992335566", phone: "6333125566", description: "As últimas tendências da moda com os melhores preços.", status: 'approved' },
  { id: "e21", name: "Ponto de Táxi Central", category_id: 11, sub_category: "Táxi / Motorista de Aplicativo", address: "Praça do Rato, Centro, Gurupi - TO", city_id: 1, latitude: -11.7270, longitude: -49.0650, rating: 4.8, whatsapp: "63992446677", phone: "6333126677", description: "Transporte rápido e seguro 24 horas por dia.", status: 'approved' },
  { id: "e22", name: "Farmácia DrogaMais", category_id: 1, sub_category: "Farmácia", address: "Av. Goiás, 1200, Centro, Gurupi - TO", city_id: 1, latitude: -11.7330, longitude: -49.0690, rating: 4.6, whatsapp: "63992557788", phone: "6333127788", description: "Sua saúde em primeiro lugar com atendimento especializado.", status: 'approved' },
  { id: "e23", name: "Casa de Carnes Boi de Ouro", category_id: 1, sub_category: "Açougue", address: "Av. Maranhão, 1500, Centro, Gurupi - TO", city_id: 1, latitude: -11.7290, longitude: -49.0675, rating: 4.9, whatsapp: "63992113344", phone: "6333124455", description: "Carnes nobres e selecionadas para o seu churrasco.", status: 'approved' },
  { id: "e24", name: "Supermercado Beira Rio", category_id: 1, sub_category: "Supermercado / Mercado", address: "Av. Goiás, 2500, Gurupi - TO", city_id: 1, latitude: -11.7360, longitude: -49.0710, rating: 4.5, whatsapp: "6333131000", phone: "6333131000", description: "O melhor preço e variedade para sua casa.", status: 'approved' },
  { id: "e25", name: "Drogaria Ultra Popular", category_id: 1, sub_category: "Farmácia", address: "Av. Goiás, 1100, Centro, Gurupi - TO", city_id: 1, latitude: -11.7270, longitude: -49.0660, rating: 4.7, whatsapp: "6333122020", phone: "6333122020", description: "Farmácia com descontos reais em medicamentos.", status: 'approved' },
  { id: "e26", name: "Gurupi Net", category_id: 2, sub_category: "Provedor de Internet / Automação / Suporte TI", address: "Rua 7, 1200, Centro, Gurupi - TO", city_id: 1, latitude: -11.7300, longitude: -49.0680, rating: 4.4, whatsapp: "6333153000", phone: "6333153000", description: "Internet ultraveloz em fibra óptica para sua casa ou empresa.", status: 'approved' },
  { id: "e27", name: "Fórum de Gurupi", category_id: 3, sub_category: "Fórum / Tribunal", address: "Av. Pará, Centro, Gurupi - TO", city_id: 1, latitude: -11.7340, longitude: -49.0740, rating: 4.2, phone: "6333112300", description: "Comarca de Gurupi - Tribunal de Justiça do Estado do Tocantins.", status: 'approved' },
  { id: "e28", name: "4º Batalhão da Polícia Militar", category_id: 3, sub_category: "Delegacia / Polícia / Bombeiros", address: "Av. Maranhão, Gurupi - TO", city_id: 1, latitude: -11.7400, longitude: -49.0800, rating: 4.8, phone: "6333121190", description: "Segurança pública e policiamento ostensivo em Gurupi.", status: 'approved' },
  { id: "e29", name: "Barbearia Vip", category_id: 4, sub_category: "Salão de Beleza / Barbearia", address: "Av. Goiás, 1800, Centro, Gurupi - TO", city_id: 1, latitude: -11.7310, longitude: -49.0690, rating: 4.9, whatsapp: "63992008877", description: "Corte moderno e ambiente climatizado para o homem de estilo.", status: 'approved' },
  { id: "e30", name: "Clínica Veterinária São Francisco", category_id: 5, sub_category: "Clínica Veterinária", address: "Av. Maranhão, 2200, Gurupi - TO", city_id: 1, latitude: -11.7330, longitude: -49.0700, rating: 4.8, phone: "6333125566", description: "Atendimento veterinário com amor e dedicação aos animais.", status: 'approved' },
  { id: "e31", name: "Posto Décio Gurupi", category_id: 6, sub_category: "Posto de Combustível", address: "Rodovia BR-153, Gurupi - TO", city_id: 1, latitude: -11.7500, longitude: -49.0900, rating: 4.6, phone: "6333128800", description: "Posto de serviços completo na BR-153.", status: 'approved' },
  { id: "e32", name: "Constrular Materiais de Construção", category_id: 7, sub_category: "Material de Construção / Ferragista", address: "Av. Goiás, 3000, Gurupi - TO", city_id: 1, latitude: -11.7400, longitude: -49.0750, rating: 4.4, phone: "6333124400", description: "Do alicerce ao acabamento, tudo para sua obra.", status: 'approved' },
  { id: "e33", name: "Imobiliária Terra", category_id: 8, sub_category: "Imobiliária / Corretor", address: "Av. Maranhão, 1000, Centro, Gurupi - TO", city_id: 1, latitude: -11.7260, longitude: -49.0650, rating: 4.7, phone: "6333121010", description: "Venda e aluguel de imóveis com transparência e segurança.", status: 'approved' },
  { id: "e34", name: "UNIRG - Campus I", category_id: 10, sub_category: "Universidade / Instituto Federal", address: "Av. Antônio Nunes da Silva, Gurupi - TO", city_id: 1, latitude: -11.7450, longitude: -49.0600, rating: 4.5, phone: "6333112700", description: "Universidade de Gurupi - Ensino superior de excelência.", status: 'approved' },
  { id: "e35", name: "IFTO - Campus Gurupi", category_id: 10, sub_category: "Universidade / Instituto Federal", address: "Alameda Madrid, Gurupi - TO", city_id: 1, latitude: -11.7600, longitude: -49.0500, rating: 4.8, phone: "6333115400", description: "Instituto Federal do Tocantins - Educação técnica e superior.", status: 'approved' },
  { id: "e36", name: "Ponto de Táxi Rodoviária", category_id: 11, sub_category: "Táxi / Motorista de Aplicativo", address: "Rodoviária de Gurupi, Gurupi - TO", city_id: 1, latitude: -11.7420, longitude: -49.0780, rating: 4.3, description: "Serviço de táxi disponível 24h na rodoviária.", status: 'approved' },
  { id: "e37", name: "Lojas Novo Mundo", category_id: 12, sub_category: "Móveis / Eletrodomésticos / Eletrônicos", address: "Av. Goiás, 1300, Centro, Gurupi - TO", city_id: 1, latitude: -11.7280, longitude: -49.0670, rating: 4.2, phone: "6333125050", description: "Eletrodomésticos, móveis e tecnologia para sua casa.", status: 'approved' },
  { id: "e38", name: "Magazine Luiza", category_id: 12, sub_category: "Shopping / Loja de Departamento / Outlet", address: "Av. Goiás, 1400, Centro, Gurupi - TO", city_id: 1, latitude: -11.7290, longitude: -49.0680, rating: 4.4, phone: "6333126060", description: "Vem ser feliz no Magalu de Gurupi.", status: 'approved' },
  { id: "e39", name: "Supermercado Quartetto", category_id: 1, sub_category: "Supermercado / Mercado", address: "Av. Goiás, 1800, Centro, Gurupi - TO", city_id: 1, latitude: -11.7315, longitude: -49.0685, rating: 4.7, phone: "6333154400", description: "Qualidade e variedade no coração de Gurupi.", status: 'approved' },
  { id: "e40", name: "Drogaria Globo", category_id: 1, sub_category: "Farmácia", address: "Av. Goiás, 1250, Centro, Gurupi - TO", city_id: 1, latitude: -11.7275, longitude: -49.0665, rating: 4.6, phone: "6333122030", description: "Atendimento farmacêutico completo e preços competitivos.", status: 'approved' },
  { id: "e41", name: "Mercado Municipal de Gurupi", category_id: 1, sub_category: "Supermercado / Mercado", address: "Av. Goiás, 1000, Centro, Gurupi - TO", city_id: 1, latitude: -11.7255, longitude: -49.0645, rating: 4.4, phone: "6333150000", description: "Produtos regionais frescos e tradicionais.", status: 'approved' },
  { id: "e42", name: "Supermercado Campelo", category_id: 1, sub_category: "Supermercado / Mercado", address: "Av. Maranhão, 2200, Centro, Gurupi - TO", city_id: 1, latitude: -11.7335, longitude: -49.0705, rating: 4.8, phone: "6333124400", description: "Tradição em servir bem a família gurupiense.", status: 'approved' },
  { id: "e43", name: "Farmácia Biofórmula", category_id: 1, sub_category: "Farmácia", address: "Av. Maranhão, 1300, Centro, Gurupi - TO", city_id: 1, latitude: -11.7280, longitude: -49.0670, rating: 4.9, phone: "6333121100", description: "Manipulação e medicamentos com rigor técnico.", status: 'approved' },
  { id: "e44", name: "Açougue Central", category_id: 1, sub_category: "Açougue", address: "Av. Maranhão, 1100, Centro, Gurupi - TO", city_id: 1, latitude: -11.7265, longitude: -49.0655, rating: 4.5, phone: "6333123300", description: "Carnes frescas e selecionadas diariamente.", status: 'approved' },
  { id: "e45", name: "Hospital Unimed Gurupi", category_id: 3, sub_category: "Hospital / Clínica / UPA", address: "Av. Pará, 2500, Gurupi - TO", city_id: 1, latitude: -11.7345, longitude: -49.0735, rating: 4.7, phone: "6333112000", description: "Atendimento médico hospitalar de alta qualidade.", status: 'approved' },
  { id: "e46", name: "Drogaria Rosário", category_id: 1, sub_category: "Farmácia", address: "Av. Pará, 1800, Centro, Gurupi - TO", city_id: 1, latitude: -11.7310, longitude: -49.0695, rating: 4.5, phone: "6333125500", description: "Sua saúde em boas mãos com a Drogaria Rosário.", status: 'approved' },
  { id: "e47", name: "Supermercado Supercom", category_id: 1, sub_category: "Supermercado / Mercado", address: "Av. Pará, 1200, Centro, Gurupi - TO", city_id: 1, latitude: -11.7285, longitude: -49.0665, rating: 4.3, phone: "6333126600", description: "Preço baixo e economia para o seu dia a dia.", status: 'approved' },
  { id: "e48", name: "Farmácia do Trabalhador", category_id: 1, sub_category: "Farmácia", address: "Av. Piauí, 1400, Centro, Gurupi - TO", city_id: 1, latitude: -11.7295, longitude: -49.0685, rating: 4.6, phone: "6333127700", description: "Medicamentos éticos e genéricos com o melhor preço.", status: 'approved' },
  { id: "e49", name: "Mini Mercado Piauí", category_id: 1, sub_category: "Supermercado / Mercado", address: "Av. Piauí, 1600, Centro, Gurupi - TO", city_id: 1, latitude: -11.7305, longitude: -49.0695, rating: 4.2, phone: "6333128800", description: "Conveniência e rapidez nas suas compras.", status: 'approved' },
  { id: "e50", name: "Drogaria Popular", category_id: 1, sub_category: "Farmácia", address: "Av. Mato Grosso, 1100, Centro, Gurupi - TO", city_id: 1, latitude: -11.7275, longitude: -49.0655, rating: 4.4, phone: "6333129900", description: "Atendimento humanizado e variedade em perfumaria.", status: 'approved' },
  { id: "e51", name: "Mercearia Mato Grosso", category_id: 1, sub_category: "Supermercado / Mercado", address: "Av. Mato Grosso, 1300, Centro, Gurupi - TO", city_id: 1, latitude: -11.7285, longitude: -49.0665, rating: 4.1, phone: "6333120011", description: "Produtos de mercearia e utilidades domésticas.", status: 'approved' },
  // Alimentação
  { id: "e52", name: "Churrascaria do Gaúcho", category_id: 1, sub_category: "Restaurante", address: "Av. Goiás, 2200, Centro, Gurupi - TO", city_id: 1, latitude: -11.7330, longitude: -49.0695, rating: 4.7, phone: "6333121515", description: "O melhor rodízio de carnes de Gurupi.", status: 'approved' },
  { id: "e53", name: "Lanchonete do Ponto", category_id: 1, sub_category: "Lanchonete", address: "Av. Maranhão, 1400, Centro, Gurupi - TO", city_id: 1, latitude: -11.7285, longitude: -49.0675, rating: 4.5, phone: "6333122525", description: "Salgados fritos e assados na hora.", status: 'approved' },
  { id: "e54", name: "Pizzaria Di Napoli", category_id: 1, sub_category: "Pizzaria", address: "Av. Pará, 1600, Centro, Gurupi - TO", city_id: 1, latitude: -11.7305, longitude: -49.0685, rating: 4.8, phone: "6333123535", description: "Pizzas tradicionais com borda recheada.", status: 'approved' },
  { id: "e55", name: "Restaurante Sabor de Minas", category_id: 1, sub_category: "Restaurante", address: "Av. Piauí, 1200, Centro, Gurupi - TO", city_id: 1, latitude: -11.7275, longitude: -49.0665, rating: 4.6, phone: "6333124545", description: "Comida mineira autêntica no fogão a lenha.", status: 'approved' },
  // Serviços Automotivos
  { id: "e56", name: "Posto Petrobras", category_id: 6, sub_category: "Posto de Combustível", address: "Av. Goiás, 2800, Gurupi - TO", city_id: 1, latitude: -11.7380, longitude: -49.0720, rating: 4.4, phone: "6333125656", description: "Combustível de confiança e troca de óleo.", status: 'approved' },
  { id: "e57", name: "Oficina do Alemão", category_id: 6, sub_category: "Oficina / Centro Automotivo", address: "Av. Maranhão, 2800, Setor Industrial, Gurupi - TO", city_id: 1, latitude: -11.7370, longitude: -49.0740, rating: 4.7, phone: "6333126767", description: "Especialista em injeção eletrônica e mecânica geral.", status: 'approved' },
  { id: "e58", name: "Gurupi Autopeças", category_id: 6, sub_category: "Oficina / Centro Automotivo", address: "Av. Pará, 3000, Gurupi - TO", city_id: 1, latitude: -11.7420, longitude: -49.0780, rating: 4.5, phone: "6333127878", description: "Peças para veículos nacionais e importados.", status: 'approved' },
  { id: "e59", name: "Posto Ipiranga", category_id: 6, sub_category: "Posto de Combustível", address: "Av. Piauí, 2000, Gurupi - TO", city_id: 1, latitude: -11.7350, longitude: -49.0710, rating: 4.3, phone: "6333128989", description: "Conveniência AM/PM e combustível de qualidade.", status: 'approved' },
  // Lazer e Bem-estar
  { id: "e60", name: "Academia Corpo e Mente", category_id: 9, sub_category: "Clube / Academia / Quadra", address: "Av. Goiás, 3200, Gurupi - TO", city_id: 1, latitude: -11.7410, longitude: -49.0740, rating: 4.8, phone: "6333129090", description: "Musculação, funcional e artes marciais.", status: 'approved' },
  { id: "e61", name: "Parque Mutuca", category_id: 9, sub_category: "Parques", address: "Av. Beira Rio, Gurupi - TO", city_id: 1, latitude: -11.7300, longitude: -49.0600, rating: 4.9, description: "O principal ponto de encontro e lazer de Gurupi.", status: 'approved' },
  { id: "e62", name: "Igreja Presbiteriana de Gurupi", category_id: 9, sub_category: "Igrejas / Templos / Comunidades Religiosas", address: "Av. Maranhão, 1600, Centro, Gurupi - TO", city_id: 1, latitude: -11.7305, longitude: -49.0685, rating: 4.7, phone: "6333120101", description: "Comunidade cristã reformada.", status: 'approved' },
  { id: "e63", name: "Clube da OAB Gurupi", category_id: 9, sub_category: "Clube / Academia / Quadra", address: "Av. Mato Grosso, Gurupi - TO", city_id: 1, latitude: -11.7450, longitude: -49.0800, rating: 4.6, description: "Lazer e esportes para advogados e convidados.", status: 'approved' },
  // Educação
  { id: "e64", name: "Colégio Objetivo Gurupi", category_id: 10, sub_category: "Escola (infantil ao médio)", address: "Av. Goiás, 1100, Centro, Gurupi - TO", city_id: 1, latitude: -11.7270, longitude: -49.0660, rating: 4.8, phone: "6333121212", description: "Ensino de qualidade do infantil ao pré-vestibular.", status: 'approved' },
  { id: "e65", name: "Faculdade Unicamps", category_id: 10, sub_category: "Universidade / Instituto Federal", address: "Av. Maranhão, 2000, Gurupi - TO", city_id: 1, latitude: -11.7320, longitude: -49.0700, rating: 4.5, phone: "6333122323", description: "Cursos superiores e pós-graduação.", status: 'approved' },
  { id: "e66", name: "Escola Estadual Costa e Silva", category_id: 10, sub_category: "Escola (infantil ao médio)", address: "Av. Pará, Centro, Gurupi - TO", city_id: 1, latitude: -11.7330, longitude: -49.0720, rating: 4.3, phone: "6333123434", description: "Educação pública tradicional em Gurupi.", status: 'approved' },
  { id: "e67", name: "CNA Inglês e Espanhol", category_id: 10, sub_category: "Escola de Idiomas", address: "Av. Piauí, 1500, Centro, Gurupi - TO", city_id: 1, latitude: -11.7300, longitude: -49.0690, rating: 4.9, phone: "6333124545", description: "Aprenda um novo idioma com metodologia dinâmica.", status: 'approved' },
  // Palmas Establishments
  { id: "p1", name: "Hospital Geral de Palmas (HGP)", category_id: 3, sub_category: "Hospital / Clínica / UPA", address: "NS 01, Qd. 201 Sul, Palmas - TO", city_id: 2, latitude: -10.1950, longitude: -48.3330, rating: 4.2, phone: "6332187800", description: "Principal hospital público do estado do Tocantins.", status: 'approved' },
  { id: "p2", name: "Capim Dourado Shopping", category_id: 12, sub_category: "Shopping / Loja de Departamento / Outlet", address: "Qd. 107 Norte, NS 05, Palmas - TO", city_id: 2, latitude: -10.1750, longitude: -48.3350, rating: 4.7, phone: "6332129500", description: "O maior shopping center do Tocantins com cinema e praça de alimentação.", status: 'approved' },
  { id: "p3", name: "UFT - Campus Palmas", category_id: 10, sub_category: "Universidade / Instituto Federal", address: "Qd. 109 Norte, Av. NS 15, Palmas - TO", city_id: 2, latitude: -10.1780, longitude: -48.3600, rating: 4.6, phone: "6332294400", description: "Universidade Federal do Tocantins - Campus Universitário de Palmas.", status: 'approved' },
  { id: "p4", name: "Palácio Araguaia", category_id: 3, sub_category: "Prefeitura / Câmara / Secretarias", address: "Praça dos Girassóis, Palmas - TO", city_id: 2, latitude: -10.1840, longitude: -48.3330, rating: 4.8, description: "Sede do Governo do Estado do Tocantins.", status: 'approved' },
  { id: "p5", name: "Supermercado Quartetto", category_id: 1, sub_category: "Supermercado / Mercado", address: "Qd. 204 Sul, Av. LO 05, Palmas - TO", city_id: 2, latitude: -10.1980, longitude: -48.3300, rating: 4.5, phone: "6332154400", description: "Rede de supermercados tocantinense com produtos de qualidade.", status: 'approved' },
  { id: "p6", name: "Praia da Graciosa", category_id: 9, sub_category: "Parques", address: "Orla de Palmas, Palmas - TO", city_id: 2, latitude: -10.1850, longitude: -48.3650, rating: 4.7, description: "Principal ponto turístico e de lazer de Palmas às margens do Lago.", status: 'approved' },
  { id: "p7", name: "Palmas Shopping", category_id: 12, sub_category: "Shopping / Loja de Departamento / Outlet", address: "Qd. 101 Sul, Av. LO 01, Palmas - TO", city_id: 2, latitude: -10.1880, longitude: -48.3300, rating: 4.5, phone: "6332212000", description: "Shopping center tradicional no centro de Palmas.", status: 'approved' },
  { id: "p8", name: "Restaurante Cabana do Lago", category_id: 1, sub_category: "Restaurante", address: "Qd. 103 Sul, Rua LO 01, Palmas - TO", city_id: 2, latitude: -10.1860, longitude: -48.3310, rating: 4.8, phone: "6332154321", description: "Culinária regional e peixes do Tocantins.", status: 'approved' },
  { id: "p9", name: "Farmácia Pague Menos", category_id: 1, sub_category: "Farmácia", address: "Av. JK, Qd. 104 Sul, Palmas - TO", city_id: 2, latitude: -10.1830, longitude: -48.3340, rating: 4.6, phone: "6332151010", description: "Farmácia com grande variedade e atendimento 24h.", status: 'approved' },
  { id: "p10", name: "Hotel Girassol Plaza", category_id: 1, sub_category: "Hospedagem (hotel, pousada, temporada)", address: "Qd. 101 Norte, NS 01, Palmas - TO", city_id: 2, latitude: -10.1760, longitude: -48.3320, rating: 4.7, phone: "6332120700", description: "Hotel de alto padrão no centro de Palmas.", status: 'approved' },
  // Araguaína Establishments
  { id: "a1", name: "Hospital Regional de Araguaína", category_id: 3, sub_category: "Hospital / Clínica / UPA", address: "Av. Dom Emanuel, Araguaína - TO", city_id: 3, latitude: -7.1900, longitude: -48.2050, rating: 4.0, phone: "6334112600", description: "Atendimento hospitalar de referência no norte do estado.", status: 'approved' },
  { id: "a2", name: "Via Lago", category_id: 9, sub_category: "Parques", address: "Av. Via Lago, Araguaína - TO", city_id: 3, latitude: -7.1850, longitude: -48.1950, rating: 4.9, description: "Cartão postal de Araguaína, ideal para caminhadas e lazer.", status: 'approved' },
  { id: "a3", name: "UFNT - Campus Araguaína", category_id: 10, sub_category: "Universidade / Instituto Federal", address: "Rua Paraguai, Araguaína - TO", city_id: 3, latitude: -7.1950, longitude: -48.2150, rating: 4.5, phone: "6334165600", description: "Universidade Federal do Norte do Tocantins.", status: 'approved' },
  { id: "a4", name: "Araguaína Park Shopping", category_id: 12, sub_category: "Shopping / Loja de Departamento / Outlet", address: "Av. Bernardo Sayão, Araguaína - TO", city_id: 3, latitude: -7.2100, longitude: -48.2250, rating: 4.6, phone: "6334115500", description: "Shopping center com diversas lojas e opções de lazer.", status: 'approved' },
  { id: "a5", name: "Supermercado Campelo", category_id: 1, sub_category: "Supermercado / Mercado", address: "Av. Filadélfia, Araguaína - TO", city_id: 3, latitude: -7.1880, longitude: -48.2020, rating: 4.7, phone: "6334117000", description: "Tradição e qualidade em supermercado em Araguaína.", status: 'approved' },
  { id: "a6", name: "Rodoviária de Araguaína", category_id: 11, sub_category: "Transporte Público (ônibus)", address: "Av. Filadélfia, Araguaína - TO", city_id: 3, latitude: -7.1920, longitude: -48.2080, rating: 4.1, description: "Terminal rodoviário de passageiros de Araguaína.", status: 'approved' },
  { id: "a7", name: "Restaurante Tio Patinhas", category_id: 1, sub_category: "Restaurante", address: "Av. Prefeito João de Sousa Lima, Araguaína - TO", city_id: 3, latitude: -7.1890, longitude: -48.2060, rating: 4.5, phone: "6334141234", description: "Restaurante tradicional com buffet variado.", status: 'approved' },
  { id: "a8", name: "Premier Hotel", category_id: 1, sub_category: "Hospedagem (hotel, pousada, temporada)", address: "Av. Bernardo Sayão, Araguaína - TO", city_id: 3, latitude: -7.2050, longitude: -48.2200, rating: 4.6, phone: "6334113000", description: "Conforto e praticidade para sua estadia em Araguaína.", status: 'approved' },
  { id: "a9", name: "Colégio Santa Cruz", category_id: 10, sub_category: "Escola (infantil ao médio)", address: "Av. Dom Emanuel, Araguaína - TO", city_id: 3, latitude: -7.1910, longitude: -48.2040, rating: 4.8, phone: "6334114455", description: "Instituição de ensino tradicional em Araguaína.", status: 'approved' },
];

app.get("/api/debug-supabase", async (req, res) => {
  const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  const debug: any = {
    timestamp: new Date().toISOString(),
    config: {
      has_url: !!sUrl,
      has_key: !!sKey,
      url_prefix: sUrl ? sUrl.substring(0, 20) : null,
    },
    tables: {}
  };

    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: cities, error: cityErr } = await supabase.from('cities').select('*').limit(5);
        debug.tables.cities = { count: cities?.length || 0, error: cityErr?.message, sample: cities };

        const { data: ests, error: estErr } = await supabase.from('establishments').select('*, opening_hours:establishment_opening_hours(*)').limit(5);
      debug.tables.establishments = { count: ests?.length || 0, error: estErr?.message, sample: ests };
      
      if (ests && ests.length > 0) {
        debug.tables.establishments.columns = Object.keys(ests[0]);
      }
    } catch (e: any) {
      debug.error = e.message;
    }
  }

  res.json(debug);
});

app.get("/api/vercel-debug", async (req, res) => {
  const supabase = getSupabaseAdmin();
  const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  const result: any = {
    env: {
      VERCEL: process.env.VERCEL || "false",
      NODE_ENV: process.env.NODE_ENV,
      HAS_SUPABASE_URL: !!sUrl,
      HAS_SUPABASE_SERVICE_KEY: !!sKey,
      HAS_SUPABASE_ANON_KEY: !!anonKey,
      URL_PLACEHOLDER: sUrl?.includes('placeholder')
    },
    supabase_connection: "waiting..."
  };

  if (supabase) {
    try {
      const { count, error } = await supabase.from('cities').select('*', { count: 'exact', head: true });
      if (error) {
        result.supabase_connection = `Error: ${error.message}`;
      } else {
        result.supabase_connection = `Success! Found ${count} cities.`;
        
        const { count: estCount, error: estErr } = await supabase.from('establishments').select('*', { count: 'exact', head: true });
        result.establishments_count = estCount || 0;
        if (estErr) result.establishments_error = estErr.message;
        
        // Also check if any exist at all without filters
        const { data: sample } = await supabase.from('establishments').select('name, city_id').limit(3);
        result.sample = sample;
      }
    } catch (e: any) {
      result.supabase_connection = `Exception: ${e.message}`;
    }
  } else {
    result.supabase_connection = "Supabase client not initialized. Check URL and Key configuration.";
  }

  res.json(result);
});

// API Routes
app.get("/api/admin/sync-mock-data", async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: "Supabase admin client not available" });
  }

  const results: any = {
    states: [],
    cities: [],
    establishments: []
  };

  try {
    // 1. Sync States
    const { data: stateData, error: stateErr } = await supabase
      .from('states')
      .upsert([{ name: 'Tocantins', uf: 'TO' }], { onConflict: 'uf' })
      .select();
    
    if (stateErr) throw stateErr;
    const toId = stateData[0].id;
    results.states = { count: stateData.length, status: 'synced' };

    // 2. Sync Cities
    const citiesToSync = [
      { state_id: toId, name: 'Gurupi', slug: 'gurupi', active: true, latitude: -11.7298, longitude: -49.0678, population: 87593 },
      { state_id: toId, name: 'Palmas', slug: 'palmas', active: true, latitude: -10.1844, longitude: -48.3336, population: 306296 },
      { state_id: toId, name: 'Araguaína', slug: 'araguaina', active: true, latitude: -7.1925, longitude: -48.2078, population: 183381 }
    ];

    for (const city of citiesToSync) {
      const { data: cityData, error: cityErr } = await supabase
        .from('cities')
        .upsert([city], { onConflict: 'slug' })
        .select();
      results.cities.push({ name: city.name, status: cityErr ? 'error' : 'synced', error: cityErr?.message });
    }

    // 3. Sync Establishments
    const { data: allCities } = await supabase.from('cities').select('id, slug');
    const cityMap: any = {};
    allCities?.forEach(c => cityMap[c.slug] = c.id);

    const mockCityMap: any = {
      1: 'gurupi',
      2: 'palmas',
      3: 'araguaina'
    };

    for (const est of establishments) {
      const { id, ...rest } = est;
      const supabaseCityId = cityMap[mockCityMap[est.city_id]];
      
      if (!supabaseCityId) {
        results.establishments.push({ name: est.name, status: 'error', error: 'City not found' });
        continue;
      }

      const estToInsert = {
        ...rest,
        city_id: supabaseCityId,
        status: 'approved',
        is_featured: est.is_featured || false,
        is_verified: est.is_verified || false,
        is_premium: est.is_premium || false
      };

      // Check if exists
      const { data: existing } = await supabase
        .from('establishments')
        .select('id')
        .eq('name', est.name)
        .eq('city_id', supabaseCityId)
        .maybeSingle();

      if (!existing) {
        const { error: estErr } = await supabase
          .from('establishments')
          .insert([estToInsert]);
        results.establishments.push({ name: est.name, status: estErr ? 'error' : 'inserted', error: estErr?.message });
      } else {
        results.establishments.push({ name: est.name, status: 'already_exists' });
      }
    }

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, results });
  }
});

app.get("/api/health", async (req, res) => {
  const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  let supabase_status = "not_configured";
  let table_schema: any = null;

  if (sUrl && sKey && !sUrl.includes('placeholder')) {
    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        supabase_status = "initialization_failed_check_logs";
      } else {
        const { count, error } = await supabase.from('cities').select('*', { count: 'exact', head: true });
        if (error) {
          supabase_status = `error: ${error.message}`;
        } else {
          supabase_status = `connected (${count} cities)`;
          const { data: ests } = await supabase.from('establishments').select('*').limit(5);
          if (ests && ests.length > 0) {
            table_schema = Object.keys(ests[0]);
          } else {
            supabase_status += " | but establishments table is empty";
          }
        }
      }
    } catch (e: any) {
      supabase_status = `exception: ${e.message}`;
    }
  }

  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    mock_data_count: {
      establishments: establishments.length,
      cities: cities.length
    },
    supabase: {
      status: supabase_status,
      has_url: !!sUrl,
      has_key: !!sKey,
      url_prefix: sUrl ? sUrl.substring(0, 20) : null,
      detected_columns: table_schema
    },
    env: {
      node_env: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
      has_gemini_key: !!(process.env.GEMINI_API_KEY || process.env.API_KEY)
    }
  });
});

app.get("/api/states", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from('states').select('*').order('name');
      if (error) throw error;
      return res.json(data || []);
    }
    res.json(states);
  } catch (error) {
    console.error("Error fetching states:", error);
    res.json(states);
  }
});

app.get("/api/cities", async (req, res) => {
  const { state_uf } = req.query;
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      let query = supabase.from('cities').select('*, states!inner(uf)');
      if (state_uf) {
        query = query.eq('states.uf', String(state_uf).toUpperCase());
      }
      const { data, error } = await query.order('name');
      if (error) throw error;
      if (data && data.length > 0) {
        return res.json(data);
      }
      // If Supabase is connected but table is empty, fallback to mock data
      console.warn("[API] Supabase cities table is empty, falling back to mock data");
    }
    
    if (state_uf) {
      const state = states.find(s => s.uf === String(state_uf).toUpperCase());
      if (!state) return res.json([]);
      return res.json(cities.filter(c => c.state_id === state.id));
    }
    res.json(cities);
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.json(cities);
  }
});

app.get("/api/cities/search", async (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  if (!q) return res.json([]);
  
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const sanitizedQ = sanitizeSupabaseQuery(q);
      const { data, error } = await supabase
        .from('cities')
        .select('*, states!inner(uf)')
        .or(`name.ilike.%${sanitizedQ}%,states.uf.ilike.%${sanitizedQ}%`)
        .eq('active', true)
        .limit(10);
      if (error) throw error;
      return res.json(data || []);
    }

    const results = cities.filter(c => {
      const state = states.find(s => s.id === c.state_id);
      const fullName = `${c.name} ${state?.uf}`.toLowerCase();
      return fullName.includes(q) || c.name.toLowerCase().includes(q);
    });
    res.json(results);
  } catch (error) {
    console.error("Error searching cities:", error);
    res.json([]);
  }
});

app.post("/api/cities/resolve-by-geo", async (req, res) => {
  const { lat, lng } = req.body;
  
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('cities').select('*, states(uf)').eq('active', true);
        if (error) throw error;
        
        if (data && data.length > 0) {
          let nearest = data[0];
          let minDist = Infinity;
          data.forEach(c => {
            const d = Math.sqrt(Math.pow(c.latitude - lat, 2) + Math.pow(c.longitude - lng, 2));
            if (d < minDist) { minDist = d; nearest = c; }
          });
          return res.json({ ...nearest, uf: nearest.states?.uf || nearest.states?.[0]?.uf || "" });
        }
      } catch (err: any) {
        console.warn("[Supabase] Fallback to mock cities due to fetch error in resolve-by-geo");
      }
    }

    let nearest = cities[0];
    let minDist = Infinity;
    cities.forEach(c => {
      const d = Math.sqrt(Math.pow(c.latitude - lat, 2) + Math.pow(c.longitude - lng, 2));
      if (d < minDist) { minDist = d; nearest = c; }
    });
    const state = states.find(s => s.id === nearest.state_id);
    res.json({ ...nearest, uf: state?.uf });
  } catch (error) {
    console.error("Error resolving city by geo:", error);
    res.json(cities[0]);
  }
});

// Helper to resolve city IDs from Supabase by name to handle ID mismatches
async function resolveCityIdsByName(supabase: any, cityId: any): Promise<number[]> {
  const cityIdNum = Number(String(cityId || "").split(':')[0]);
  if (isNaN(cityIdNum)) return [];
  
  if (cityIdCache.has(cityIdNum)) {
    return cityIdCache.get(cityIdNum)!;
  }

  const mockCity = cities.find(c => c.id === cityIdNum);
  const cityName = mockCity ? mockCity.name : "Gurupi";

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      // Add a timeout to the supabase request
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Supabase timeout (15s)")), 15000)
      );

      const fetchPromise = (async () => {
        const { data: matchingCities, error: queryError } = await supabase
          .from('cities')
          .select('id')
          .ilike('name', cityName);
        
        if (queryError) throw queryError;
        
        if (matchingCities && matchingCities.length > 0) {
          const ids = matchingCities.map((c: any) => c.id);
          cityIdCache.set(cityIdNum, ids);
          return ids;
        }
        return [cityIdNum];
      })();

      return await Promise.race([fetchPromise, timeoutPromise]) as number[];
    }
  } catch (err: any) {
    console.warn(`[Supabase] City resolution failed for ${cityName}:`, err.message);
  }
  
  return [cityIdNum];
}

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const cleanQuery = (text: string) => {
  // Remove all punctuation and special characters, keep only letters, numbers and spaces
  return normalize(text).replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();
};

// Fuzzy search dictionary for "smart" matching
let fuseInstance: Fuse<string> | null = null;
const getFuseInstance = () => {
  if (fuseInstance) return fuseInstance;
  
  // Collect all unique sub-categories and some common terms
  const subCategories = Array.from(new Set(establishments.map(e => e.sub_category)));
  const commonTerms = [
    "restaurante", "lanchonete", "pizzaria", "farmácia", "supermercado", "açougue", 
    "oficina", "pet shop", "academia", "escola", "hospital", "clínica", 
    "posto de combustível", "barbearia", "salão de beleza", "padaria", "confeitaria",
    "mecânica", "borracharia", "dentista", "médico", "advogado", "contabilidade",
    "igreja", "templo", "parque", "praça", "prefeitura", "câmara municipal",
    "delegacia", "polícia", "bombeiros", "táxi", "uber", "transporte",
    "hotel", "pousada", "motel", "shopping", "loja", "vestuário", "calçados",
    "eletrônicos", "móveis", "eletrodomésticos", "informática", "internet",
    "papelaria", "livraria", "brinquedos", "presentes", "floricultura",
    "sorveteria", "açaí", "cafeteria", "bar", "pub", "boate", "cervejaria",
    "espetinho", "churrascaria", "japonês", "sushi", "chinês", "italiano",
    "hamburgueria", "pastelaria", "lanche", "comida caseira", "marmitex"
  ];
  const dictionary = Array.from(new Set([...subCategories, ...commonTerms]));
  
  fuseInstance = new Fuse(dictionary, {
    includeScore: true,
    threshold: 0.4,
    distance: 100,
    ignoreLocation: true
  });
  return fuseInstance;
};

const smartCorrectQuery = (q: string) => {
  if (!q || q.length < 3) return q;
  
  const fuse = getFuseInstance();
  const results = fuse.search(q);
  
  if (results.length > 0 && results[0].score && results[0].score < 0.3) {
    console.log(`[Smart Search] Corrected "${q}" to "${results[0].item}" (score: ${results[0].score})`);
    return results[0].item;
  }
  
  return q;
};

const sanitizeSupabaseQuery = (text: string) => {
  // Remove special characters that can break Supabase .or() logic tree
  return text.replace(/[()[\],]/g, ' ').replace(/\s+/g, ' ').trim();
};

// API chat moved to frontend service
app.post("/api/chat", async (req, res) => {
  const { message, city, userLocation, localContext, categoryFilter, subCategoryFilter } = req.body;

  if (!message || !city) {
    return res.status(400).json({ error: "Mensagem e cidade são obrigatórios." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const lat = userLocation?.latitude || city.latitude;
    const lng = userLocation?.longitude || city.longitude;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", 
      contents: [{ role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction: `Você é VidaLocal, um guia para ${city.name}. Ajude o usuário a encontrar locais.
          ${TAXONOMY_CONTEXT}
          Contexto local (estabelecimentos já cadastrados): ${localContext || 'Nenhum'}
          ${categoryFilter ? `Filtro de categoria: ${categoryFilter}` : ''}
          ${subCategoryFilter ? `Filtro de tipo: ${subCategoryFilter}` : ''}
          
          Comece sua resposta sempre com uma frase clara como: "Em ${city.name} - ${city.uf}, você pode encontrar os seguintes estabelecimentos que oferecem serviços de [Busca]:"
          
          Sempre use a ferramenta Google Maps para encontrar e confirmar a localização de todos os estabelecimentos que você mencionar na resposta.
          Ao listar estabelecimentos, use SEMPRE o formato de lista (usando asteriscos *) para que cada local apareça em um box separado no chat.
          Para cada local, coloque o nome em negrito e descreva brevemente o endereço e o que o local oferece.`,
        tools: [{ googleMaps: {} } as any],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng },
          },
        } as any,
      },
    });

    const text = response.text || "Sem resposta textual.";
    
    // Process grounding chunks
    const groundingChunks = (response as any).candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => {
      return {
        maps: chunk.maps ? { 
          uri: chunk.maps.uri, 
          title: chunk.maps.title,
          location: chunk.maps.location,
          address: chunk.maps.address || chunk.maps.formattedAddress,
          phone: chunk.maps.phone || chunk.maps.phoneNumber,
          rating: chunk.maps.rating,
        } : undefined,
        web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
      };
    }).filter((c: any) => c.maps || c.web) || [];

    return res.json({ role: "model", text, groundingChunks });
  } catch (error: any) {
    console.error("[Chat API Error]:", error.message);
    const isQuota = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
    return res.status(isQuota ? 429 : 500).json({ 
      error: isQuota ? "QUOTA_EXCEEDED" : "TECHNICAL_ERROR",
      message: error.message 
    });
  }
});

app.get("/api/establishments/category/:categoryId", async (req, res) => {
  const { categoryId } = req.params;
  const { city_id } = req.query;
  const cleanCityId = String(city_id || "").split(':')[0];
  const cityIdNum = Number(cleanCityId);
  const cacheKey = `category-${categoryId}-${cleanCityId}`;

  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const targetCityIds = await resolveCityIdsByName(supabase, city_id);

      let query = supabase.from('establishments').select('*');
      query = query.eq('category_id', Number(categoryId));

      if (targetCityIds.length > 0) {
        query = query.in('city_id', targetCityIds);
      }
      
      const { data, error } = await query
        .order('is_premium', { ascending: false })
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })
        .limit(40);
      
      if (!error && data && data.length > 0) {
        setCache(cacheKey, data);
        return res.json(data);
      }
    }

    // Fallback to mock data
    const results = establishments.filter(e => 
      e.category_id === Number(categoryId) && 
      (!cleanCityId || e.city_id === cityIdNum)
    ).sort((a, b) => {
      const premA = a.is_premium ? 1 : 0;
      const premB = b.is_premium ? 1 : 0;
      if (premA !== premB) return premB - premA;

      const featA = a.is_featured ? 1 : 0;
      const featB = b.is_featured ? 1 : 0;
      if (featA !== featB) return featB - featA;

      return (b.rating || 0) - (a.rating || 0);
    }).slice(0, 30);

    res.json(results);
  } catch (error: any) {
    console.error("[API Error] Category establishments:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/debug-state", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    const debug: any = {
      timestamp: new Date().toISOString(),
      env: {
        node_env: process.env.NODE_ENV,
        is_vercel: !!process.env.VERCEL,
        has_supabase_url: !!sUrl,
        has_supabase_key: !!sKey,
        supabase_url_preview: sUrl ? sUrl.substring(0, 15) + "..." : null,
      },
      supabase: {
        active: !!supabase,
        database: supabase ? (supabase as any).supabaseUrl : null,
      },
      mock: {
        cities_count: cities.length,
        establishments_count: establishments.length
      }
    };

    if (supabase) {
      const [{ data: dbCities, error: cityErr }, { data: dbEsts, error: estErr }] = await Promise.all([
        supabase.from('cities').select('id, name').limit(10),
        supabase.from('establishments').select('id, name, city_id').limit(10)
      ]);
      
      debug.supabase.discovery = {
        cities: { count: dbCities?.length || 0, error: cityErr?.message, sample: dbCities },
        establishments: { count: dbEsts?.length || 0, error: estErr?.message, sample: dbEsts }
      };
    }

    res.json(debug);
  } catch (err: any) {
    res.status(500).json({ error: "Debug failed", message: err.message });
  }
});

app.get("/api/establishments/featured", async (req, res) => {
  const { city_id } = req.query;
  // Handle malformed city_id like "1:1"
  const cleanCityId = String(city_id || "").split(':')[0];
  const cityIdNum = Number(cleanCityId);
  const cacheKey = `featured-${cleanCityId}`;

  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const supabase = getSupabaseAdmin();
    console.log(`[API] Fetching featured for city_id: ${cleanCityId}. Supabase available: ${!!supabase}`);
    
    if (supabase) {
      const targetCityIds = await resolveCityIdsByName(supabase, city_id);
      console.log(`[API] Resolved city search for "${city_id}" to target IDs:`, targetCityIds);

      const { data, error } = await supabase
        .from('establishments')
        .select('*')
        .in('city_id', targetCityIds)
        .eq('status', 'approved') // Only show approved ones
        .order('is_featured', { ascending: false })
        .order('is_premium', { ascending: false })
        .order('rating', { ascending: false })
        .limit(10);

      if (error) {
        console.error("[Supabase Error] Querying featured:", error.message);
      } else if (data && data.length > 0) {
        console.log(`[API] Found ${data.length} featured establishments in Supabase`);
        setCache(cacheKey, data);
        return res.json(data);
      } else {
        console.warn(`[API] No featured establishments found in Supabase for IDs:`, targetCityIds);
      }
    }
    
    // Fallback logic
    console.log(`[API] Falling back to mock featured data for city ${cityIdNum} ("${cleanCityId}")`);
    
    // Try to find the city name to use broader fallback
    const mockCity = cities.find(c => c.id === cityIdNum);
    const cityName = mockCity ? mockCity.name : null;

    const results = establishments.filter(e => {
      if (!cleanCityId) return true;
      if (e.city_id === cityIdNum) return true;
      // If we have a city name, also match by that in case IDs shifted
      if (cityName && cities.find(c => c.id === e.city_id)?.name === cityName) return true;
      return false;
    }).sort((a, b) => {
      if (a.is_premium && !b.is_premium) return -1;
      if (!a.is_premium && b.is_premium) return 1;
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    }).slice(0, 9);
    
    console.log(`[API] Fallback found ${results.length} results`);
    res.json(results);
  } catch (error: any) {
    console.error("[API Error] Featured establishments:", error.message);
    res.json(establishments.slice(0, 8));
  }
});

app.post("/api/suggest-hours", async (req, res) => {
  const { name, city, address } = req.body;
  
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Quais são os horários de funcionamento de "${name}" em ${city}${address ? `, no endereço ${address}` : ''}? 
    Responda EXCLUSIVAMENTE em formato JSON com os seguintes campos:
    {
      "summary": "string curta resumindo os horários",
      "is24h": boolean,
      "structured": [
        {"day": 0, "closed": boolean, "slots": [{"open": "HH:MM", "close": "HH:MM"}]},
        ... (um para cada dia, 0=Domingo a 6=Sábado)
      ]
    }
    Se não encontrar horários confiáveis, responda apenas o objeto com campos nulos ou vazios.`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "null";
    
    res.json(JSON.parse(text || "null"));
  } catch (error: any) {
    console.error("[API Error] Suggesting hours:", error);
    res.status(500).json({ error: "Erro ao sugerir horários", message: error.message });
  }
});

app.get("/api/search/suggest", async (req, res) => {
  const rawQ = String(req.query.q || "");
  const q = normalize(rawQ);
  if (!q) return res.json({ intents: [], types: [] });
  
  const cacheKey = `suggest-${q}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      // 1. Search in search_intents (direct name match)
      const { data: intentsData } = await supabase
        .from('search_intents')
        .select('id, name')
        .ilike('name', `%${q}%`)
        .eq('active', true)
        .limit(5);

      // 2. Search in search_keywords (keyword match)
      const { data: keywordIntents } = await supabase
        .from('search_keywords')
        .select('intent_id, search_intents(id, name)')
        .ilike('keyword', `%${q}%`)
        .limit(5);

      // 3. Search in establishments (sub_category match)
      const { data: typesData } = await supabase
        .from('establishments')
        .select('sub_category')
        .ilike('sub_category', `%${q}%`)
        .eq('status', 'approved')
        .limit(20);
      
      const combinedIntents = [...(intentsData || [])];
      keywordIntents?.forEach((ki: any) => {
        const intent = ki.search_intents;
        if (intent && !combinedIntents.find(ci => ci.id === intent.id)) {
          combinedIntents.push(intent);
        }
      });

      const types = Array.from(new Set(typesData?.map(e => e.sub_category) || [])).slice(0, 5);
      const result = { intents: combinedIntents.slice(0, 5), types };
      setCache(cacheKey, result);
      return res.json(result);
    }

    // Fallback dictionary for Intentional Search
    const DICTIONARY: Record<string, string[]> = {
      "Restaurante": ["comer", "fome", "almoço", "jantar", "comida", "restaurante", "gastronomia"],
      "Lanchonete": ["lanche", "hamburguer", "podrão", "salgado", "lanchonete", "hot dog"],
      "Pizzaria": ["pizza", "massa", "italiana", "pizzaria"],
      "Padaria": ["pão", "café", "bolo", "doce", "padaria", "confeitaria"],
      "Farmácia": ["remedio", "dor", "saude", "drogaria", "farmacia", "medicamento"],
      "Supermercado": ["compras", "mercado", "rancho", "mantimentos", "supermercado", "hipermercado"],
      "Açougue": ["carne", "churrasco", "picanha", "frango", "açougue", "boutique de carnes"],
      "Hortifruti": ["fruta", "verdura", "legume", "feira", "hortifruti", "sacolão"],
      "Oficina": ["carro", "conserto", "mecanico", "pneu", "oficina", "auto eletrica"],
      "Pet Shop": ["cachorro", "gato", "ração", "banho", "pet shop", "veterinario"],
      "Posto": ["gasolina", "etanol", "diesel", "combustivel", "posto"],
    };

    const intents = Object.entries(DICTIONARY)
      .filter(([name, keywords]) => 
        normalize(name).includes(q) || keywords.some(k => normalize(k).includes(q))
      )
      .map(([name], index) => ({ id: index + 1, name }))
      .slice(0, 5);

    const types = Array.from(new Set(establishments
      .filter(e => normalize(e.sub_category).includes(q))
      .map(e => e.sub_category)
    )).slice(0, 5);

    res.json({ intents, types });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    res.json({ intents: [], types: [] });
  }
});

app.get("/api/search", async (req, res) => {
  const rawQ = String(req.query.q || "");
  const originalQ = cleanQuery(rawQ);
  let q = originalQ;
  const { city_id, category_id, sub_category } = req.query;
  
  // Robust city_id parsing (handles "1:1" browser suffix issue)
  const cleanCityId = String(city_id || "").split(':')[0];
  const cityIdNum = Number(cleanCityId);
  
  const cacheKey = `search-${q}-${cleanCityId}-${category_id}-${sub_category}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const supabase = getSupabaseAdmin();
  
  try {
    if (supabase) {
      const targetCityIds = await resolveCityIdsByName(supabase, city_id);
      const mockCity = cities.find(c => c.id === cityIdNum);
      const cityName = mockCity ? mockCity.name : "Gurupi";

      // Optimized fetch: get both approved and pending in one go, but prioritize approved
      const fetchFromSupabase = async (currentQ: string) => {
        try {
          let query = supabase.from('establishments').select('*'); // Removed opening_hours join for stability
          
          if (targetCityIds.length > 0) {
            query = query.in('city_id', targetCityIds);
          }

          if (category_id) {
            query = query.eq('category_id', Number(category_id));
          }

          if (sub_category) {
            const subStr = String(sub_category);
            if (subStr.includes('/')) {
              const parts = subStr.split('/').map(p => p.trim()).filter(p => p.length > 0);
              const orParts = parts.map(p => `sub_category.ilike.%${p}%`).join(',');
              query = query.or(orParts);
            } else {
              query = query.ilike('sub_category', `%${subStr}%`);
            }
          }

          if (currentQ) {
            const sanitizedQ = sanitizeSupabaseQuery(currentQ);
            const cityNames = [cityName, "Gurupi", "Palmas", "Araguaína"];
            let searchTerms = sanitizedQ;
            cityNames.forEach(cn => {
              searchTerms = searchTerms.replace(new RegExp(cn, 'gi'), '');
            });
            searchTerms = searchTerms.replace(/\b(em|no|na|de|do|da|para|com)\b/gi, '').trim();

            const queryWords = searchTerms.split(/\s+/).filter(w => w.length > 2);
            
            let orConditions = `name.ilike.%${sanitizedQ}%,description.ilike.%${sanitizedQ}%,address.ilike.%${sanitizedQ}%,sub_category.ilike.%${sanitizedQ}%`;
            
            if (queryWords.length > 0) {
              const wordConditions = queryWords.map(w => 
                `name.ilike.%${w}%,description.ilike.%${w}%,address.ilike.%${w}%,sub_category.ilike.%${w}%`
              ).join(',');
              orConditions += `,${wordConditions}`;
            }
            query = query.or(orConditions);
          }
          
          // Order by: approved first, then premium, then featured, then rating
          query = query
            .order('status', { ascending: false }) // 'approved' starts with 'a', so false priority depends on strings. Better check below.
            // Wait, Postgres order of 'approved' vs 'pending' vs 'rejected' might be tricky.
            // Let's use numeric columns or multiple orders.
            .order('is_premium', { ascending: false })
            .order('is_featured', { ascending: false })
            .order('rating', { ascending: false });

          // Fetch more than we need to allow for filtering/prioritization
          const result = await query.limit(50);
          if (result.error) return result;

          // Still sort in JS to handle status priority properly (approved > others)
          const sortedData = (result.data || []).sort((a: any, b: any) => {
            if (a.status === 'approved' && b.status !== 'approved') return -1;
            if (a.status !== 'approved' && b.status === 'approved') return 1;
            if (a.is_premium && !b.is_premium) return -1;
            if (!a.is_premium && b.is_premium) return 1;
            if (a.is_featured && !b.is_featured) return -1;
            if (!a.is_featured && b.is_featured) return 1;
            return 0;
          });

          return { data: sortedData.slice(0, 20), error: null };
        } catch (e: any) {
          const isNetworkError = e.message?.includes('fetch failed') || e.code === 'ENOTFOUND';
          console.error("[Supabase Exception]:", e.message);
          if (isNetworkError) {
            console.error("[Supabase Warning] Falha na conexão de rede. Verifique seu VITE_SUPABASE_URL.");
          }
          return { data: null, error: e };
        }
      };

      const start = Date.now();
      let { data, error } = await fetchFromSupabase(q);
      console.log(`[API Search] Supabase query for "${q}" took ${Date.now() - start}ms`);
      
      // If no results, try fuzzy correction
      if ((!data || data.length === 0) && q && !category_id && !sub_category) {
        const corrected = smartCorrectQuery(q);
        if (corrected !== q) {
          console.log(`[Smart Search] No results for "${q}", trying corrected query: "${corrected}"`);
          const retryStart = Date.now();
          const retry = await fetchFromSupabase(corrected);
          console.log(`[API Search] Supabase retry for "${corrected}" took ${Date.now() - retryStart}ms`);
          if (retry.data && retry.data.length > 0) {
            data = retry.data;
            error = retry.error;
            q = corrected;
          }
        }
      }

      if (error) {
        console.error("[Supabase Search Error]:", error.message);
      }
      
      if (data && data.length > 0) {
        setCache(cacheKey, data);
        return res.json(data);
      }

      // If no results and it was a general search, try cities
      if (q && !category_id && !sub_category) {
        const { data: cityData } = await supabase
          .from('cities')
          .select('*, states(uf)')
          .ilike('name', `%${q}%`)
          .eq('active', true);
        
        if (cityData && cityData.length > 0) {
          const results = cityResultsMap(cityData);
          setCache(cacheKey, results);
          return res.json(results);
        }
      }
    }
      
    // Ultimate fallback for search: if Supabase returned nothing, try mock data
    console.log(`[API] Supabase search returned 0 results for "${q}", falling back to mock data`);
    
    // Get city name for name-based matching if ID might be different
    let cityName = "";
    if (cityIdNum && !isNaN(cityIdNum)) {
      // Try to find city name in Supabase cities or mock cities
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: cityData } = await supabase.from('cities').select('name').eq('id', cityIdNum).single();
        if (cityData) cityName = cityData.name;
      }
      if (!cityName) {
        cityName = cities.find(c => c.id === cityIdNum)?.name || "";
      }
    }

    let mockResults = establishments.filter(e => {
      const eCity = cities.find(c => c.id === e.city_id);
      const matchCity = !isNaN(cityIdNum) ? (e.city_id === cityIdNum || (cityName && eCity && normalize(eCity.name) === normalize(cityName))) : true;
      const matchCategory = category_id ? e.category_id === Number(category_id) : true;
      const matchSub = sub_category ? normalize(e.sub_category).includes(normalize(String(sub_category))) : true;
      
      if (!q) return matchCity && matchCategory && matchSub;

      const normName = normalize(e.name);
      const normSub = normalize(e.sub_category);
      const normDesc = normalize(e.description || "");
      const normAddr = normalize(e.address || "");
      
      const queryWords = q.split(/\s+/).filter(w => w.length > 2);
      const matchText = normName.includes(q) || normSub.includes(q) || normDesc.includes(q) || normAddr.includes(q) ||
                        queryWords.some(w => normName.includes(w) || normSub.includes(w) || normDesc.includes(w) || normAddr.includes(w));

      return matchCity && matchCategory && matchSub && matchText;
    });

    // If no mock results, try fuzzy correction for mock data too
    if (mockResults.length === 0 && q && !category_id && !sub_category) {
      const corrected = smartCorrectQuery(q);
      if (corrected !== q) {
        console.log(`[Smart Search] No mock results for "${q}", trying corrected query: "${corrected}"`);
        mockResults = establishments.filter(e => {
          const eCity = cities.find(c => c.id === e.city_id);
          const matchCity = city_id ? (e.city_id === Number(city_id) || (cityName && eCity && normalize(eCity.name) === normalize(cityName))) : true;
          const normName = normalize(e.name);
          const normSub = normalize(e.sub_category);
          const normDesc = normalize(e.description || "");
          return matchCity && (normName.includes(corrected) || normSub.includes(corrected) || normDesc.includes(corrected));
        });
      }
    }

    if (mockResults.length === 0 && q && !category_id && !sub_category) {
      const cityResults = cities.filter(c => {
        const state = states.find(s => s.id === c.state_id);
        const fullName = normalize(`${c.name} ${state?.uf}`);
        return fullName.includes(q) || normalize(c.name).includes(q);
      });
      return res.json(cityResults);
    }
    
    // Sort mock results: Premium -> Featured -> Others
    const sortedMockResults = mockResults.sort((a, b) => {
      if (a.is_premium && !b.is_premium) return -1;
      if (!a.is_premium && b.is_premium) return 1;
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    });

    return res.json(sortedMockResults.slice(0, 20));
  } catch (error) {
    console.error("Search error:", error);
    // Fallback to mock data on error
    res.json(establishments.slice(0, 10));
  }
});

function cityResultsMap(data: any[]) {
  return data?.map(c => ({ ...c, uf: c.states?.uf || c.states?.[0]?.uf || "" })) || [];
}

app.get("/api/establishments/user/:userId", async (req, res) => {
  const { userId } = req.params;
  console.log(`[API] Fetching establishments for user: ${userId}`);
  
  if (!userId || userId === 'undefined' || userId === 'null') {
    console.warn("[API] Invalid userId provided to fetch establishments");
    return res.json([]);
  }

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from('establishments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("[Supabase Error] Fetching user establishments:", error);
        throw error;
      }
      return res.json(data || []);
    }
    
    // Fallback to local establishments for this session
    const userEsts = establishments.filter(e => e.user_id === userId);
    console.log(`[API] Found ${userEsts.length} local establishments for user ${userId}`);
    res.json(userEsts);
  } catch (error: any) {
    console.error("[API Error] Error fetching user establishments:", error);
    res.status(500).json({ 
      error: "Erro ao buscar seus cadastros", 
      message: error.message || "Erro interno no servidor" 
    });
  }
});

app.put("/api/establishments/:id", async (req, res) => {
  const { id } = req.params;
  const registration = req.body;
  const userId = (req.headers['x-user-id'] || req.headers['x-vidalocal-user-id']) as string;
  
  const { images, ...logData } = registration;
  console.log(`[API] Updating establishment ${id}:`, JSON.stringify(logData, null, 2), images ? `(${images.length} images)` : "(no images)");
  
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      // Permission check
      const isAdminByEmail = registration.userEmail === 'alcidinopk@gmail.com';
      const hasPermission = isAdminByEmail || await canUserEdit(supabase, userId, id);
      
      if (!hasPermission) {
        console.warn(`[API] Permission denied for user ${userId} / ${registration.userEmail} on establishment ${id}`);
        return res.status(403).json({ 
          error: "Você não tem permissão para editar este estabelecimento.",
          debug: { userId, estId: id, email: registration.userEmail }
        });
      }

      const updatePayload: any = {
        name: registration.name,
        category_id: Number(registration.categoryId),
        sub_category: registration.subCategory,
        address: registration.address,
        phone: registration.phone,
        whatsapp: registration.whatsapp,
        website: registration.website,
        hours: registration.hours,
        is_open_24_hours: registration.is_open_24_hours,
        description: registration.description,
        latitude: registration.latitude,
        longitude: registration.longitude,
        maps_link: registration.mapsLink,
        plus_code: registration.plusCode,
        city_id: registration.cityId ? Number(registration.cityId) : null,
        state_id: registration.stateId ? Number(registration.stateId) : null,
        images: registration.images || []
      };

      // Only allow admins to change premium/featured status
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
      const isAdminGlobal = profile?.role === 'admin';

      if (isAdminGlobal || isAdminByEmail) {
        updatePayload.is_featured = registration.is_featured;
        updatePayload.is_verified = registration.is_verified;
        updatePayload.is_premium = registration.is_premium;
      }

      console.log(`[API] Attempting update for ${id}. IsAdminGlobal: ${isAdminGlobal}, IsAdminByEmail: ${isAdminByEmail}`);

      // Determine if we should update by ID (UUID) or Short ID
      const isUuid = id.length > 30 && id.includes('-');
      
      // Try to find the exact record first to see if it even exists
      let recordToUpdate = null;
      if (isUuid) {
        const { data: found } = await supabase.from('establishments').select('id, short_id').eq('id', id).maybeSingle();
        recordToUpdate = found;
      } else {
        const { data: found } = await supabase.from('establishments').select('id, short_id').eq('short_id', id).maybeSingle();
        recordToUpdate = found;
      }

      if (!recordToUpdate) {
        // If not found, check if it's a mock ID (e.g., e11, p3, a2)
        const isMockId = /^[epa]\d+$/.test(id);
        
        if (isMockId) {
          console.log(`[API] Mock establishment ID ${id} detected for update. Redirecting to INSERT (Register)...`);
          
          // Prepare for insert
          const insertPayload = {
            ...updatePayload,
            user_id: userId,
            status: 'approved', // Automatically approve updates to mock data saved by users (or keep pending?)
            short_id: generateShortId()
          };
          
          const { data: insertedData, error: insertError } = await supabase
            .from('establishments')
            .insert([insertPayload])
            .select();
            
          if (insertError) {
            console.error(`[Supabase Error] Creating replacement for mock ${id}:`, insertError);
            return res.status(500).json({ error: "Erro ao salvar cópia do estabelecimento: " + insertError.message });
          }
          
          return res.json(insertedData[0]);
        }

        console.warn(`[API] Establishment NOT FOUND for ID/ShortID: ${id}`);
        return res.status(404).json({ error: `Estabelecimento não encontrado no banco de dados (ID: ${id}). Verifique se os dados iniciais estão corretos.` });
      }

      console.log(`[API] Record found! Real UUID: ${recordToUpdate.id}. Proceeding with update...`);

      const { data, error } = await supabase
        .from('establishments')
        .update(updatePayload)
        .eq('id', recordToUpdate.id)
        .select();

      if (error) {
        console.error(`[Supabase Error] Updating establishment ${id}:`, JSON.stringify(error, null, 2));
        
        let userMessage = "Erro ao atualizar no banco de dados";
        if (error.code === '42703') {
          userMessage = "Erro de esquema: Uma ou mais colunas não foram encontradas na tabela 'establishments'.";
          if (error.message && error.message.includes('is_open_24_hours')) {
            userMessage = "Erro de esquema: A coluna 'is_open_24_hours' não foi encontrada na tabela 'establishments'. Por favor, execute o comando SQL: ALTER TABLE establishments ADD COLUMN is_open_24_hours BOOLEAN DEFAULT FALSE;";
          } else if (error.message && error.message.includes('plus_code')) {
            userMessage = "Erro de esquema: A coluna 'plus_code' não foi encontrada na tabela 'establishments'. Por favor, execute o comando SQL: ALTER TABLE establishments ADD COLUMN plus_code TEXT;";
          } else if (error.message && error.message.includes('images')) {
            userMessage = "Erro de esquema: A coluna 'images' não foi encontrada na tabela 'establishments'. Por favor, execute o comando SQL: ALTER TABLE establishments ADD COLUMN images TEXT[];";
          }
        } else if (error.message) {
          userMessage = `Erro no Supabase: ${error.message}`;
        }

        return res.status(400).json({ 
          error: userMessage, 
          message: error.message,
          code: error.code
        });
      }

      // Update opening hours if provided
      if (data && data[0] && registration.openingHours) {
        try {
          // Delete existing hours first to avoid unique constraint issues
          await supabase.from('establishment_opening_hours').delete().eq('establishment_id', data[0].id);
          
          const hoursToInsert = registration.openingHours.map((h: any) => ({
            establishment_id: data[0].id,
            ...h
          }));
          
          const { error: hoursError } = await supabase.from('establishment_opening_hours').insert(hoursToInsert);
          if (hoursError) console.error("[Supabase Error] Updating opening hours:", hoursError);
        } catch (err) {
          console.error("[API] Error updating opening hours:", err);
        }
      }
      
      if (!data || data.length === 0) {
        console.warn(`[API] No establishment found with ID ${id} in Supabase`);
        return res.status(404).json({ error: "Estabelecimento não encontrado no banco de dados" });
      }

      console.log(`[API] Establishment ${id} updated successfully in Supabase`);
      clearCache();
      return res.json(data?.[0]);
    } else {
      // Local fallback - fix ID comparison
      const index = establishments.findIndex(e => String(e.id) === String(id));
      if (index !== -1) {
        establishments[index] = {
          ...establishments[index],
          name: registration.name,
          category_id: Number(registration.categoryId),
          sub_category: registration.subCategory,
          address: registration.address,
          phone: registration.phone,
          whatsapp: registration.whatsapp,
          website: registration.website,
          hours: registration.hours,
          is_open_24_hours: registration.is_open_24_hours,
          description: registration.description,
          latitude: registration.latitude || establishments[index].latitude,
          longitude: registration.longitude || establishments[index].longitude,
          city_id: Number(registration.cityId),
          is_featured: registration.is_featured,
          is_verified: registration.is_verified,
          is_premium: registration.is_premium,
          images: registration.images || []
        };
        console.log(`[API] Establishment ${id} updated successfully in local memory`);
        clearCache();
        return res.json(establishments[index]);
      }
      return res.status(404).json({ error: "Estabelecimento não encontrado na memória local" });
    }
  } catch (error: any) {
    console.error(`[API Error] Updating establishment ${id}:`, error);
    res.status(500).json({ 
      error: "Erro interno ao atualizar estabelecimento", 
      message: error.message || "Erro interno no servidor" 
    });
  }
});

// --- GEOLOCATION SERVICE (Nominatim) ---
async function reverseGeocode(lat: number, lng: number) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      {
        headers: { "User-Agent": "VidaLocal-App-Geocoding-Service" }
      }
    );
    
    if (!response.ok) throw new Error(`Nominatim API Error: ${response.statusText}`);
    
    const data = await response.json();
    const address = data.address;

    // Mapeamento inteligente para o Brasil
    const cityName = address.city || address.town || address.village || address.municipality;
    const stateUf = address["ISO3166-2-lvl4"]?.split("-")[1] || address.state; // Tenta pegar UF sigla
    const stateName = address.state;

    if (!cityName || !stateUf) return null;

    return { cityName, stateUf, stateName };
  } catch (error) {
    console.error("[Geocoding] Fatal error:", error);
    return null;
  }
}

// --- MAINTENANCE & BACKFILL ---
app.post("/api/maintenance/backfill-geo", async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: "DB not connected" });

  // Segurança: Apenas admins (ou verificação de chave secreta)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'admin') return res.status(403).json({ error: "Permission denied" });

  // 1. Busca estabelecimentos sem city_id ou state_id que tenham coordenadas
  const { data: records, error } = await supabase
    .from('establishments')
    .select('id, name, latitude, longitude')
    .or('city_id.is.null,state_id.is.null')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(50); // Processa em lotes para segurança

  if (error) return res.status(500).json({ error: error.message });

  let processedCount = 0;
  let errorCount = 0;

  console.log(`[Backfill] Starting for ${records?.length} records...`);

  for (const record of (records || [])) {
    try {
      // Respeita o limite de 1 requisição/seg do Nominatim
      await new Promise(resolve => setTimeout(resolve, 1100));

      const geo = await reverseGeocode(record.latitude, record.longitude);
      
      if (geo) {
        const resolved = await resolveCityAndState(supabase, geo);
        if (resolved) {
          await supabase.from('establishments').update({
            city_id: resolved.cityId,
            state_id: resolved.stateId
          }).eq('id', record.id);
          processedCount++;
        }
      }
    } catch (err) {
      console.error(`[Backfill] Failed record ${record.id}:`, err);
      errorCount++;
    }
  }

  res.json({ 
    message: "Processamento concluído", 
    batchSize: records?.length, 
    processed: processedCount,
    errors: errorCount 
  });
});

app.delete("/api/establishments/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'] as string;
  
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      // 1. Identify if it's a mock ID
      const isMockId = /^[epa]\d+$/.test(id);
      
      // 2. Determine the real UUID to delete
      const isUuid = id.length > 30 && id.includes('-');
      let realId = id;
      let recordInDb = null;

      if (!isUuid) {
        const { data: found } = await supabase
          .from('establishments')
          .select('id, user_id')
          .eq('short_id', id)
          .maybeSingle();
        
        if (found) {
          realId = found.id;
          recordInDb = found;
        } else if (isMockId) {
          // It's a mock ID not in DB, so we just "pretend" to delete
          console.log(`[API] Mock ID ${id} requested for delete. No record in DB, returning success.`);
          return res.json({ success: true, message: "Mock establishment removed (not in DB)" });
        } else {
          return res.status(404).json({ error: "Estabelecimento não encontrado para exclusão." });
        }
      } else {
        // It's a UUID, check if it exists
        const { data: found } = await supabase
          .from('establishments')
          .select('id, user_id')
          .eq('id', id)
          .maybeSingle();
        recordInDb = found;
      }

      // 3. Permission check
      const hasPermission = await canUserEdit(supabase, userId, recordInDb ? id : (isUuid ? id : id)); 
      // canUserEdit already handles ID/ShortID and Admin status
      
      if (!hasPermission) {
        return res.status(403).json({ error: "Você não tem permissão para excluir este estabelecimento." });
      }

      if (recordInDb) {
        const { error } = await supabase
          .from('establishments')
          .delete()
          .eq('id', recordInDb.id);

        if (error) throw error;
      }
      
      clearCache();
      return res.json({ success: true });
    } else {
      const index = establishments.findIndex(e => e.id === id);
      if (index !== -1) {
        // Mock permission check
        if (userId && establishments[index].user_id !== userId) {
          return res.status(403).json({ error: "Acesso negado." });
        }
        establishments.splice(index, 1);
        clearCache();
        return res.json({ success: true });
      }
      return res.status(404).json({ error: "Estabelecimento não encontrado" });
    }
  } catch (error: any) {
    console.error("[API Error] Deleting establishment:", error);
    res.status(500).json({ error: "Erro ao excluir estabelecimento", message: error.message });
  }
});

// Admin Permissions Endpoints
app.get("/api/admin/permissions/:shortId", async (req, res) => {
  const { shortId } = req.params;
  const userId = req.headers['x-user-id'] as string;
  
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: "Supabase not connected" });

    // Check if requester is owner
    const { data: est } = await supabase.from('establishments').select('user_id').eq('short_id', shortId).maybeSingle();
    if (!est || est.user_id !== userId) {
      return res.status(403).json({ error: "Somente o criador pode gerenciar permissões." });
    }

    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('establishment_short_id', shortId);
    
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/permissions", async (req, res) => {
  const { email, shortId, role } = req.body;
  const requesterId = req.headers['x-user-id'] as string;

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: "Supabase not connected" });

    // Verify ownership
    const { data: est } = await supabase.from('establishments').select('user_id').eq('short_id', shortId).maybeSingle();
    if (!est || est.user_id !== requesterId) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    // Find user by email (we need their ID if possible, otherwise we use email)
    // Note: Supabase auth.users is protected, usually we'd have a public users table
    // For now we'll store user_email in the permissions table as requested
    const { data, error } = await supabase
      .from('user_permissions')
      .insert([{
        user_email: email,
        establishment_short_id: shortId,
        role: role || 'editor'
      }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/admin/permissions/:permissionId", async (req, res) => {
  const { permissionId } = req.params;
  const requesterId = req.headers['x-user-id'] as string;

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: "Supabase not connected" });

    // Get permission to check ownership of the establishment
    const { data: perm } = await supabase.from('user_permissions').select('establishment_short_id').eq('id', permissionId).maybeSingle();
    if (perm) {
      const { data: est } = await supabase.from('establishments').select('user_id').eq('short_id', perm.establishment_short_id).maybeSingle();
      if (!est || est.user_id !== requesterId) {
        return res.status(403).json({ error: "Acesso negado." });
      }

      const { error } = await supabase.from('user_permissions').delete().eq('id', permissionId);
      if (error) throw error;
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/establishments/export", async (req, res) => {
  const { category_id, sub_category, city_id, state_uf } = req.query;
  
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      let query = supabase.from('establishments').select('*, opening_hours:establishment_opening_hours(*), cities(*, states(*))');
      
      if (category_id) query = query.eq('category_id', Number(category_id));
      if (sub_category) query = query.eq('sub_category', String(sub_category));
      if (city_id) query = query.eq('city_id', Number(city_id));
      
      const { data, error } = await query;
      if (error) throw error;
      
      let filteredData = data || [];
      
      // Filter by state UF if provided (since it's nested)
      if (state_uf) {
        filteredData = filteredData.filter((e: any) => 
          e.cities?.states?.uf === String(state_uf).toUpperCase()
        );
      }
      
      return res.json(filteredData);
    }
    
    // Fallback for mock data
    let filtered = [...establishments];
    if (category_id) filtered = filtered.filter(e => e.category_id === Number(category_id));
    if (sub_category) filtered = filtered.filter(e => e.sub_category === String(sub_category));
    if (city_id) filtered = filtered.filter(e => e.city_id === Number(city_id));
    
    // For mock data, we'd need to join with cities/states to filter by UF
    if (state_uf) {
      filtered = filtered.filter(e => {
        const city = cities.find(c => c.id === e.city_id);
        const state = states.find(s => s.id === city?.state_id);
        return state?.uf === String(state_uf).toUpperCase();
      });
    }
    
    res.json(filtered);
  } catch (error: any) {
    console.error("[API Error] Exporting establishments:", error);
    res.status(500).json({ error: "Erro ao exportar estabelecimentos", message: error.message });
  }
});

app.get("/api/admin/establishments/missing-hours", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from('establishments')
        .select('*')
        .or('hours.is.null,hours.eq.Horário não informado,hours.eq.Não informado,hours.eq.')
        .limit(50);

      if (error) throw error;
      return res.json(data || []);
    }
    
    const missing = establishments.filter(e => !e.hours || e.hours.includes("não informado") || e.hours === "");
    res.json(missing.slice(0, 50));
  } catch (error: any) {
    console.error("[API Error] Fetching missing hours:", error);
    res.status(500).json({ error: "Erro ao buscar estabelecimentos", message: error.message });
  }
});

app.patch("/api/establishments/:id", async (req, res) => {
  const { id } = req.params;
  const { hours, is_open_24_hours, openingHours } = req.body;
  const userId = req.headers['x-user-id'] as string;
  
  console.log(`[API] Updating hours for establishment ${id}: ${hours}`);

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      // Permission check
      const hasPermission = await canUserEdit(supabase, userId, id);
      if (!hasPermission) {
        return res.status(403).json({ error: "Acesso negado." });
      }

      const { data, error } = await supabase
        .from('establishments')
        .update({ 
          hours,
          is_open_24_hours: is_open_24_hours || false
        })
        .eq('id', id)
        .select();

      if (error) throw error;

      // Update opening hours if provided
      if (data && data[0] && openingHours) {
        try {
          await supabase.from('establishment_opening_hours').delete().eq('establishment_id', data[0].id);
          const hoursToInsert = openingHours.map((h: any) => ({
            establishment_id: data[0].id,
            ...h
          }));
          await supabase.from('establishment_opening_hours').insert(hoursToInsert);
        } catch (err) {
          console.error("[API] Error updating opening hours in PATCH:", err);
        }
      }
      
      clearCache();
      return res.json({ success: true, data: data?.[0] });
    }

    // Fallback for mock data (session only)
    const index = establishments.findIndex(e => e.id === id);
    if (index !== -1) {
      establishments[index].hours = hours;
      return res.json({ success: true, data: establishments[index] });
    }

    res.status(404).json({ error: "Establishment not found" });
  } catch (error: any) {
    console.error("[API Error] Updating establishment hours:", error);
    res.status(500).json({ error: "Erro ao atualizar horário", message: error.message });
  }
});

app.post("/api/establishments/register", async (req, res) => {
  console.log("[API] Hit POST /api/establishments/register");
  // return res.json({ status: "debug", message: "Reached server!" }); // Uncomment for deeper debug
  const registration = req.body;
  const { images, ...logData } = registration;
  console.log("[API] Registering new establishment:", JSON.stringify(logData, null, 2), images ? `(${images.length} images)` : "(no images)");

  try {
    // SQL Schema for 'establishments' table:
    /*
    CREATE TABLE establishments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      sub_category TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      whatsapp TEXT,
      website TEXT,
      hours TEXT,
      is_open_24_hours BOOLEAN DEFAULT FALSE,
      description TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      maps_link TEXT,
      city_id INTEGER NOT NULL,
      user_id UUID REFERENCES auth.users(id),
      status TEXT DEFAULT 'approved',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    */

    const supabase = getSupabaseAdmin();
    if (supabase) {
      let targetCityId = Number(registration.cityId);
      let targetStateId: number | null = null;

      // TRIGGER LÓGICA: Se city_id for inválido (0 ou -1) ou estiver faltando, e tivermos coordenadas,
      // disparamos o Geocoding reverso como um "trigger" de aplicação.
      const hasCoords = (registration.latitude && registration.longitude) || (registration.cityLat && registration.cityLng);

      if ((!targetCityId || targetCityId <= 0) && hasCoords) {
        try {
          console.log(`[API Register] Missing city_id. Attempting auto-geocoding...`);
          const lat = registration.latitude || registration.cityLat;
          const lng = registration.longitude || registration.cityLng;
          
          const geo = await reverseGeocode(lat, lng);
          if (geo) {
            const resolved = await resolveCityAndState(supabase, geo);
            if (resolved) {
              targetCityId = resolved.cityId;
              targetStateId = resolved.stateId;
              console.log(`[API Register] Auto-resolved to city_id: ${targetCityId}, state_id: ${targetStateId}`);
            }
          }
        } catch (geoErr) {
          console.error("[API Register] Auto-geocoding resolution failed:", geoErr);
        }
      }

      // Map mock ID to real Supabase ID if necessary (for pre-defined cities)
      if (targetCityId > 0 && targetCityId < 100) {
        const mockCity = cities.find(c => c.id === targetCityId);
        if (mockCity) {
          try {
            console.log(`[API Register] Resolving real city ID for: ${mockCity.name}`);
            const { data: realCity, error: cityMapError } = await supabase
              .from('cities')
              .select('id')
              .ilike('name', mockCity.name)
              .maybeSingle(); // maybeSingle instead of single() to avoid 406
            
            if (cityMapError) throw cityMapError;

            if (realCity) {
              console.log(`[API Register] Mapping mock city ID ${targetCityId} to Supabase ID ${realCity.id}`);
              targetCityId = realCity.id;
            } else {
              console.warn(`[API Register] City "${mockCity.name}" not found in Supabase. Using mock ID ${targetCityId}`);
            }
          } catch (err: any) {
            console.warn(`[API Register] City mapping failed:`, err.message);
          }
        }
      }

      console.log(`[API Register] Inserting into establishments (city_id: ${targetCityId})...`);
      const sId = generateShortId();
      
      // Ensure user_id is a valid UUID or null
      const userId = (registration.userId && registration.userId.length > 10) ? registration.userId : null;
      
      const { data, error } = await supabase.from('establishments').insert([{
        name: registration.name,
        short_id: sId,
        category_id: Number(registration.categoryId),
        sub_category: registration.subCategory,
        address: registration.address,
        phone: registration.phone,
        whatsapp: registration.whatsapp,
        website: registration.website,
        hours: registration.hours,
        is_open_24_hours: registration.is_open_24_hours || false,
        description: registration.description,
        latitude: registration.latitude || registration.cityLat || -11.7298,
        longitude: registration.longitude || registration.cityLng || -49.0678,
        maps_link: registration.mapsLink,
        plus_code: registration.plusCode,
        city_id: targetCityId,
        state_id: targetStateId,
        user_id: userId,
        status: 'approved',
        is_featured: registration.is_featured || false,
        is_verified: registration.is_verified || false,
        is_premium: registration.is_premium || false,
        images: registration.images || []
      }]).select();

      if (error) {
        console.error("[Supabase Error] Registering establishment:", JSON.stringify(error, null, 2));
        
        let userMessage = "Erro ao salvar no banco de dados";
        if (error.code === '42P01') {
          userMessage = "Tabela 'establishments' não encontrada no Supabase. Por favor, crie a tabela no seu painel do Supabase.";
        } else if (error.code === '42703' || (error.message && error.message.includes('user_id'))) {
          userMessage = "Erro de esquema: A coluna 'user_id' não foi encontrada na tabela 'establishments'. Certifique-se de que ela existe e é do tipo UUID.";
        } else if (error.code === '42703' && error.message && error.message.includes('maps_link')) {
          userMessage = "Erro de esquema: Coluna 'maps_link' não encontrada na tabela 'establishments'. Verifique se ela existe.";
        } else if (error.code === '42703' && error.message && error.message.includes('is_open_24_hours')) {
          userMessage = "Erro de esquema: A coluna 'is_open_24_hours' não foi encontrada na tabela 'establishments'. Por favor, execute o comando SQL: ALTER TABLE establishments ADD COLUMN is_open_24_hours BOOLEAN DEFAULT FALSE;";
        } else if (error.code === '42703' && error.message && error.message.includes('plus_code')) {
          userMessage = "Erro de esquema: A coluna 'plus_code' não foi encontrada na tabela 'establishments'. Por favor, execute o comando SQL: ALTER TABLE establishments ADD COLUMN plus_code TEXT;";
        } else if (error.code === '42703' && error.message && error.message.includes('images')) {
          userMessage = "Erro de esquema: A coluna 'images' não foi encontrada na tabela 'establishments'. Por favor, execute o comando SQL: ALTER TABLE establishments ADD COLUMN images TEXT[];";
        } else if (error.message) {
          userMessage = `Erro no Supabase: ${error.message}`;
        }

        return res.status(400).json({ 
          error: userMessage, 
          message: error.message,
          code: error.code
        });
      }

      // Insert opening hours if provided
      if (data && data[0] && registration.openingHours) {
        try {
          const hoursToInsert = registration.openingHours.map((h: any) => ({
            establishment_id: data[0].id,
            ...h
          }));
          const { error: hoursError } = await supabase.from('establishment_opening_hours').insert(hoursToInsert);
          if (hoursError) console.error("[Supabase Error] Inserting opening hours:", hoursError);
        } catch (err) {
          console.error("[API] Error inserting opening hours:", err);
        }
      }
      
      console.log("[API] Establishment registered successfully in Supabase");
      clearCache();
      return res.json({ 
        status: "approved", 
        message: "Seu estabelecimento foi cadastrado e já está visível!",
        data: data?.[0],
        supabase: true
      });
    } else {
      // Persist locally for the session if Supabase is not available
      const newEstablishment = {
        id: `e${Date.now()}`,
        short_id: generateShortId(),
        name: registration.name,
        category_id: Number(registration.categoryId),
        sub_category: registration.subCategory,
        address: registration.address,
        phone: registration.phone,
        whatsapp: registration.whatsapp,
        website: registration.website,
        hours: registration.hours,
        is_open_24_hours: registration.is_open_24_hours || false,
        description: registration.description,
        latitude: registration.latitude || -11.7298,
        longitude: registration.longitude || -49.0678,
        city_id: Number(registration.cityId),
        user_id: registration.userId,
        rating: 5.0,
        status: 'approved',
        is_featured: registration.is_featured || false,
        is_verified: registration.is_verified || false,
        is_premium: registration.is_premium || false,
        images: registration.images || [],
        created_at: new Date().toISOString()
      };
      establishments.push(newEstablishment);
      console.log("[API] New establishment registered locally for user:", registration.userId, newEstablishment.name);
      clearCache();
      
      return res.json({ 
        status: "approved", 
        message: "Seu estabelecimento foi cadastrado localmente e já está visível!",
        data: newEstablishment,
        supabase: false
      });
    }
  } catch (error: any) {
    console.error("[API Error] Registering establishment:", error);
    res.status(500).json({ 
      error: "Erro interno ao processar cadastro", 
      message: error.message 
    });
  }
});

// Vite middleware for development
const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
const isVercel = !!process.env.VERCEL;

if (!isProd) {
  // Dynamic import without top-level await to avoid making the module async
  const vitePromise = import("vite").then(m => m.createServer({ 
    server: { middlewareMode: true }, 
    appType: "spa" 
  }));
  
  app.use(async (req, res, next) => {
    try {
      const vite = await vitePromise;
      vite.middlewares(req, res, next);
    } catch (err) {
      next(err);
    }
  });
} else if (!isVercel) {
  // Static serving for production (only if NOT on Vercel)
  // On Vercel, static files are handled by vercel.json rewrites
  const rootDir = __dirname;
  const distPath = path.resolve(rootDir, "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

// Only listen if not on Vercel
if (!process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("[Global Error]:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: err.message || "Ocorreu um erro inesperado no servidor." 
  });
});

export default app;
