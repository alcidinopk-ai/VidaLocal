import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "./src/lib/supabase-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});

const app = express();
app.use(express.json());

// Check Supabase configuration on startup
const isSupabaseConfigured = process.env.VITE_SUPABASE_URL && 
                             process.env.SUPABASE_SERVICE_ROLE_KEY && 
                             !process.env.VITE_SUPABASE_URL.includes('placeholder');

console.log(`[Startup] Supabase configured: ${isSupabaseConfigured}`);

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

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
  description?: string;
  user_id?: string;
  status?: string;
  created_at?: string;
}

let establishments: Establishment[] = [
  { id: "e1", name: "Espetinho do Adão B13", category_id: 1, sub_category: "Espetinho", address: "Av. Goiás, 1438, Centro, Gurupi - TO", city_id: 1, latitude: -11.7289, longitude: -49.0692, rating: 4.8, whatsapp: "63984551234", phone: "6333121234", description: "O melhor espetinho da região com acompanhamentos tradicionais.", status: 'approved' },
  { id: "e2", name: "Delicias da Polly", category_id: 1, sub_category: "Alimentação (restaurante, lanchonete, pizzaria)", address: "Av. Maranhão, 1245, Centro, Gurupi - TO", city_id: 1, latitude: -11.7275, longitude: -49.0660, rating: 4.9, whatsapp: "63992334455", phone: "6333124455", description: "Comida caseira, lanches e sobremesas feitas com carinho.", status: 'approved' },
  { id: "e3", name: "Mecânica do Neném", category_id: 6, sub_category: "Oficina / Centro Automotivo", address: "Av. Maranhão, 2560, Setor Industrial, Gurupi - TO", city_id: 1, latitude: -11.7350, longitude: -49.0720, rating: 4.5, whatsapp: "63984112233", phone: "6333121122", description: "Manutenção preventiva e corretiva para seu veículo com confiança.", status: 'approved' },
  { id: "e4", name: "Pet Shop Amigão", category_id: 5, sub_category: "Pet Shop (varejo)", address: "Av. Goiás, 2100, Centro, Gurupi - TO", city_id: 1, latitude: -11.7320, longitude: -49.0685, rating: 4.7, whatsapp: "63999887766", phone: "6333128877", description: "Tudo para o seu pet: rações, acessórios e banho e tosa.", status: 'approved' },
  { id: "e5", name: "Pizzaria Bella Italia", category_id: 1, sub_category: "Alimentação (restaurante, lanchonete, pizzaria)", address: "Av. Pará, 1500, Centro, Gurupi - TO", city_id: 1, latitude: -11.7295, longitude: -49.0670, rating: 4.6, whatsapp: "63992112233", phone: "6333129988", description: "Pizzas artesanais com massa fina e ingredientes selecionados.", status: 'approved' },
  { id: "e6", name: "Farmácia Preço Baixo", category_id: 1, sub_category: "Farmácia", address: "Rua 5, 800, Centro, Gurupi - TO", city_id: 1, latitude: -11.7310, longitude: -49.0695, rating: 4.4, whatsapp: "63992445566", phone: "6333127766", description: "Medicamentos e perfumaria com os melhores preços da cidade.", status: 'approved' },
  { id: "e7", name: "Supermercado Araguaia", category_id: 1, sub_category: "Supermercado / Mercado", address: "Av. Goiás, 1000, Centro, Gurupi - TO", city_id: 1, latitude: -11.7260, longitude: -49.0650, rating: 4.3, whatsapp: "63992556677", phone: "6333126655", description: "Variedade em hortifruti, açougue e mercearia para sua família.", status: 'approved' },
  { id: "e8", name: "Barbearia do Zé", category_id: 4, sub_category: "Salão de Beleza / Barbearia", address: "Rua 3, 450, Centro, Gurupi - TO", city_id: 1, latitude: -11.7280, longitude: -49.0680, rating: 4.9, whatsapp: "63992667788", phone: "6333125544", description: "Corte de cabelo e barba com estilo e atendimento personalizado.", status: 'approved' },
  { id: "e9", name: "Clínica Veterinária Vida", category_id: 5, sub_category: "Clínica Veterinária", address: "Av. Maranhão, 3000, Gurupi - TO", city_id: 1, latitude: -11.7380, longitude: -49.0750, rating: 4.8, whatsapp: "63992778899", phone: "6333124433", description: "Cuidado completo para a saúde do seu animal de estimação.", status: 'approved' },
  { id: "e10", name: "Posto Central", category_id: 6, sub_category: "Posto de Combustível", address: "Av. Goiás, 500, Centro, Gurupi - TO", city_id: 1, latitude: -11.7250, longitude: -49.0640, rating: 4.2, whatsapp: "63992889900", phone: "6333123322", description: "Combustível de qualidade e conveniência 24 horas.", status: 'approved' },
  { id: "e11", name: "Restaurante Popular", category_id: 1, sub_category: "Alimentação (restaurante, lanchonete, pizzaria)", address: "Av. Maranhão, 1200, Centro, Gurupi - TO", city_id: 1, latitude: -11.7270, longitude: -49.0680, rating: 4.5, whatsapp: "63992990011", phone: "6333122211", description: "Almoço self-service com grande variedade e preço justo.", status: 'approved' },
  { id: "e12", name: "Lanchonete Central", category_id: 1, sub_category: "Alimentação (restaurante, lanchonete, pizzaria)", address: "Rua 4, 600, Centro, Gurupi - TO", city_id: 1, latitude: -11.7285, longitude: -49.0675, rating: 4.7, whatsapp: "63992001122", phone: "6333121100", description: "Salgados frescos, sucos naturais e o melhor café da manhã.", status: 'approved' },
  { id: "e13", name: "Pizzaria do Vale", category_id: 1, sub_category: "Alimentação (restaurante, lanchonete, pizzaria)", address: "Av. Pará, 2000, Gurupi - TO", city_id: 1, latitude: -11.7320, longitude: -49.0700, rating: 4.8, whatsapp: "63992112233", phone: "6333120099", description: "Pizzas no forno a lenha com bordas recheadas e muito sabor.", status: 'approved' },
  { id: "e14", name: "Hospital Regional de Gurupi", category_id: 3, sub_category: "Hospital / Clínica / UPA", address: "Av. Pará, S/N, Gurupi - TO", city_id: 1, latitude: -11.7350, longitude: -49.0750, rating: 4.1, whatsapp: "6333150200", phone: "6333150200", description: "Atendimento hospitalar de urgência e emergência para a região.", status: 'approved' },
  { id: "e15", name: "Prefeitura Municipal", category_id: 3, sub_category: "Prefeitura / Câmara / Secretarias", address: "Rua 1, Centro, Gurupi - TO", city_id: 1, latitude: -11.7250, longitude: -49.0650, rating: 4.0, whatsapp: "6333150000", phone: "6333150000", description: "Sede administrativa do poder executivo municipal de Gurupi.", status: 'approved' },
  { id: "e16", name: "Escola Municipal de Gurupi", category_id: 10, sub_category: "Escola (infantil ao médio)", address: "Rua 10, Centro, Gurupi - TO", city_id: 1, latitude: -11.7280, longitude: -49.0660, rating: 4.5, whatsapp: "6333151111", phone: "6333151111", description: "Educação de qualidade para crianças e jovens da nossa cidade.", status: 'approved' },
  { id: "e17", name: "Igreja Matriz de Gurupi", category_id: 9, sub_category: "Igrejas / Templos / Comunidades Religiosas", address: "Praça da Matriz, Centro, Gurupi - TO", city_id: 1, latitude: -11.7290, longitude: -49.0670, rating: 4.9, whatsapp: "6333152222", phone: "6333152222", description: "Comunidade religiosa acolhedora no coração de Gurupi.", status: 'approved' },
  { id: "e18", name: "Academia Fitness", category_id: 9, sub_category: "Clube / Academia / Quadra", address: "Av. Goiás, 1500, Centro, Gurupi - TO", city_id: 1, latitude: -11.7300, longitude: -49.0680, rating: 4.7, whatsapp: "63992113344", phone: "6333123344", description: "Equipamentos modernos e profissionais qualificados para seu treino.", status: 'approved' },
  { id: "e19", name: "Móveis Estrela", category_id: 12, sub_category: "Móveis / Eletrodomésticos / Eletrônicos", address: "Av. Maranhão, 1800, Centro, Gurupi - TO", city_id: 1, latitude: -11.7310, longitude: -49.0690, rating: 4.4, whatsapp: "63992224455", phone: "6333124455", description: "Móveis de qualidade para todos os ambientes da sua casa.", status: 'approved' },
  { id: "e20", name: "Moda Fashion", category_id: 12, sub_category: "Moda (feminina, masculina, infantil, fitness)", address: "Rua 5, 1000, Centro, Gurupi - TO", city_id: 1, latitude: -11.7320, longitude: -49.0700, rating: 4.6, whatsapp: "63992335566", phone: "6333125566", description: "As últimas tendências da moda com os melhores preços.", status: 'approved' },
  { id: "e21", name: "Ponto de Táxi Central", category_id: 11, sub_category: "Táxi / Motorista de Aplicativo", address: "Praça do Rato, Centro, Gurupi - TO", city_id: 1, latitude: -11.7270, longitude: -49.0650, rating: 4.8, whatsapp: "63992446677", phone: "6333126677", description: "Transporte rápido e seguro 24 horas por dia.", status: 'approved' },
  { id: "e22", name: "Farmácia DrogaMais", category_id: 1, sub_category: "Farmácia", address: "Av. Goiás, 1200, Centro, Gurupi - TO", city_id: 1, latitude: -11.7330, longitude: -49.0690, rating: 4.6, whatsapp: "63992557788", phone: "6333127788", description: "Sua saúde em primeiro lugar com atendimento especializado.", status: 'approved' },
];

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    env: {
      node_env: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
      has_gemini_key: !!(process.env.GEMINI_API_KEY || process.env.API_KEY),
      has_supabase_url: !!process.env.VITE_SUPABASE_URL
    }
  });
});

app.get("/api/states", async (req, res) => {
  try {
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      const { data, error } = await supabaseAdmin.from('states').select('*').order('name');
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
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      let query = supabaseAdmin.from('cities').select('*, states!inner(uf)');
      if (state_uf) {
        query = query.eq('states.uf', String(state_uf).toUpperCase());
      }
      const { data, error } = await query.order('name');
      if (error) throw error;
      return res.json(data || []);
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
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      const sanitizedQ = sanitizeSupabaseQuery(q);
      const { data, error } = await supabaseAdmin
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
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      // Supabase doesn't have a built-in "nearest" without PostGIS, 
      // but we can do a simple distance calculation if the dataset is small,
      // or just fetch all active cities and calculate in JS like the mock does.
      const { data, error } = await supabaseAdmin.from('cities').select('*, states(uf)').eq('active', true);
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

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const sanitizeSupabaseQuery = (text: string) => {
  // Remove special characters that can break Supabase .or() logic tree
  return text.replace(/[()[\],]/g, ' ').replace(/\s+/g, ' ').trim();
};

app.post("/api/chat", async (req, res) => {
  try {
    console.log("[Chat] Request started");
    
    const { message, city, userLocation } = req.body || {};
    
    // Diagnostic ping test
    if (message === "ping") {
      console.log("[Chat] Ping received");
      return res.json({ role: "model", text: "pong" });
    }

    if (!message) {
      return res.status(400).json({ error: "Mensagem ausente" });
    }

    const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    const apiKey = rawKey.trim();
    
    if (!apiKey || apiKey.length < 10 || apiKey.includes("YOUR_API_KEY") || apiKey.includes("MY_GEMINI_API_KEY")) {
      console.error("[Chat] Invalid or missing API Key:", apiKey ? "Present but invalid format" : "Missing");
      return res.json({ 
        role: "model", 
        text: "Chave API Gemini não configurada corretamente nos Secrets do projeto. Por favor, configure a GEMINI_API_KEY." 
      });
    }

    console.log("[Chat] Initializing Gemini with key (length):", apiKey.length);
    const ai = new GoogleGenAI({ apiKey });
    
    const lat = Number(userLocation?.latitude || city?.latitude || -11.7298);
    const lng = Number(userLocation?.longitude || city?.longitude || -49.0678);

    console.log(`[Chat] Calling Gemini 3 Flash with lat=${lat}, lng=${lng}`);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: `Você é VidaLocal, um guia para ${city?.name || 'sua cidade'}. Ajude o usuário a encontrar locais.`,
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng },
          },
        },
      },
    });

    console.log("[Chat] Response received");

    let text = "";
    try {
      text = response.text || "Sem resposta textual.";
    } catch (e: any) {
      console.warn("[Chat] Text extraction failed:", e.message);
      text = "Resposta bloqueada ou vazia.";
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      maps: chunk.maps ? { 
        uri: chunk.maps.uri, 
        title: chunk.maps.title,
        location: chunk.maps.location
      } : undefined,
      web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
    })).filter((c: any) => c.maps || c.web) || [];

    console.log("[Chat] Success");
    return res.json({ role: "model", text, groundingChunks });

  } catch (error: any) {
    console.error("[Chat] ERROR:", error);
    
    let userMessage = "Desculpe, ocorreu um erro ao processar sua busca.";
    
    if (error.message && (error.message.includes("429") || error.message.includes("quota") || error.message.includes("RESOURCE_EXHAUSTED"))) {
      userMessage = "O limite de buscas gratuitas foi atingido para hoje. Por favor, tente novamente em alguns instantes ou amanhã. Estamos trabalhando para aumentar nossa capacidade!";
    } else if (error.message && (error.message.includes("500") || error.message.includes("Internal Server Error"))) {
      userMessage = "O servidor da IA está temporariamente instável. Por favor, tente novamente em alguns segundos.";
    } else if (error.message && error.message.includes("API key")) {
      userMessage = "Erro de configuração: Chave de API inválida ou não encontrada.";
    } else {
      userMessage = `Erro: ${error.message || "Falha na comunicação com a IA"}.`;
    }

    return res.json({ 
      role: "model", 
      text: userMessage
    });
  }
});

app.get("/api/establishments/featured", async (req, res) => {
  const { city_id } = req.query;
  try {
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      let query = supabaseAdmin.from('establishments').select('*').eq('status', 'approved');
      if (city_id) {
        query = query.eq('city_id', Number(city_id));
      }
      const { data, error } = await query.limit(8).order('created_at', { ascending: false });
      if (error) throw error;
      return res.json(data || []);
    }
    const results = establishments.filter(e => !city_id || e.city_id === Number(city_id));
    res.json(results);
  } catch (error) {
    console.error("Error fetching featured establishments:", error);
    res.json(establishments);
  }
});

app.get("/api/search/suggest", async (req, res) => {
  const q = normalize(String(req.query.q || ""));
  if (!q) return res.json({ intents: [], types: [] });
  
  try {
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      // Fetch intents and types from DB
      const { data: intentsData } = await supabaseAdmin.from('search_intents').select('id, name').ilike('name', `%${q}%`).eq('active', true).limit(5);
      const { data: typesData } = await supabaseAdmin.from('establishments').select('sub_category').ilike('sub_category', `%${q}%`).eq('status', 'approved').limit(20);
      
      const types = Array.from(new Set(typesData?.map(e => e.sub_category) || [])).slice(0, 5);
      return res.json({ intents: intentsData || [], types });
    }

    const types = Array.from(new Set(establishments
      .filter(e => normalize(e.sub_category).includes(q))
      .map(e => e.sub_category)
    )).slice(0, 5);

    const intents = [
      { id: 1, name: "Restaurantes" },
      { id: 2, name: "Serviços Públicos" },
      { id: 3, name: "Saúde" }
    ].filter(i => normalize(i.name).includes(q));

    res.json({ intents, types });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    res.json({ intents: [], types: [] });
  }
});

app.get("/api/search", async (req, res) => {
  const q = normalize(String(req.query.q || ""));
  const { city_id, category_id, sub_category } = req.query;
  
  try {
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      let query = supabaseAdmin.from('establishments').select('*').eq('status', 'approved');
      
      if (city_id) {
        query = query.eq('city_id', Number(city_id));
      }

      if (category_id) {
        query = query.eq('category_id', Number(category_id));
      }

      if (sub_category) {
        query = query.ilike('sub_category', `%${sub_category}%`);
      }

      if (q) {
        const sanitizedQ = sanitizeSupabaseQuery(q);
        const queryWords = sanitizedQ.split(/\s+/).filter(w => w.length > 2);
        
        let orConditions = `name.ilike.%${sanitizedQ}%,sub_category.ilike.%${sanitizedQ}%,description.ilike.%${sanitizedQ}%,address.ilike.%${sanitizedQ}%`;
        
        if (queryWords.length > 0) {
          const wordConditions = queryWords.map(w => 
            `name.ilike.%${w}%,sub_category.ilike.%${w}%,description.ilike.%${w}%,address.ilike.%${w}%`
          ).join(',');
          orConditions += `,${wordConditions}`;
        }
        query = query.or(orConditions);
      }
      
      const { data, error } = await query.limit(20);
      if (error) throw error;
      
      if (data && data.length > 0) {
        return res.json(data);
      }

      // If no results and it was a general search, try cities
      if (q && !category_id && !sub_category) {
        const { data: cityData } = await supabaseAdmin
          .from('cities')
          .select('*, states(uf)')
          .ilike('name', `%${q}%`)
          .eq('active', true);
        
        return res.json(cityResultsMap(cityData));
      }
      
      return res.json([]);
    }

    // Local Mock Search
    let results = establishments.filter(e => {
      const matchCity = city_id && !isNaN(Number(city_id)) ? e.city_id === Number(city_id) : true;
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

    if (results.length === 0 && q && !category_id && !sub_category) {
      const cityResults = cities.filter(c => {
        const state = states.find(s => s.id === c.state_id);
        const fullName = normalize(`${c.name} ${state?.uf}`);
        return fullName.includes(q) || normalize(c.name).includes(q);
      });
      return res.json(cityResults);
    }
    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.json([]);
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
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      const { data, error } = await supabaseAdmin
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
  
  try {
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      const { data, error } = await supabaseAdmin
        .from('establishments')
        .update({
          name: registration.name,
          category_id: Number(registration.categoryId),
          sub_category: registration.subCategory,
          address: registration.address,
          phone: registration.phone,
          whatsapp: registration.whatsapp,
          website: registration.website,
          hours: registration.hours,
          description: registration.description,
          latitude: registration.latitude,
          longitude: registration.longitude,
          maps_link: registration.mapsLink,
          city_id: registration.cityId
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      return res.json(data?.[0]);
    } else {
      const index = establishments.findIndex(e => e.id === id);
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
          description: registration.description,
          latitude: registration.latitude || establishments[index].latitude,
          longitude: registration.longitude || establishments[index].longitude,
          city_id: Number(registration.cityId)
        };
        return res.json(establishments[index]);
      }
      return res.status(404).json({ error: "Estabelecimento não encontrado" });
    }
  } catch (error: any) {
    console.error("[API Error] Updating establishment:", error);
    res.status(500).json({ error: "Erro ao atualizar estabelecimento", message: error.message });
  }
});

app.delete("/api/establishments/:id", async (req, res) => {
  const { id } = req.params;
  
  try {
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      const { error } = await supabaseAdmin
        .from('establishments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.json({ success: true });
    } else {
      const index = establishments.findIndex(e => e.id === id);
      if (index !== -1) {
        establishments.splice(index, 1);
        return res.json({ success: true });
      }
      return res.status(404).json({ error: "Estabelecimento não encontrado" });
    }
  } catch (error: any) {
    console.error("[API Error] Deleting establishment:", error);
    res.status(500).json({ error: "Erro ao excluir estabelecimento", message: error.message });
  }
});

app.post("/api/establishments/register", async (req, res) => {
  const registration = req.body;
  console.log("[API] Registering new establishment:", JSON.stringify(registration, null, 2));

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

    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      const { data, error } = await supabaseAdmin.from('establishments').insert([{
        name: registration.name,
        category_id: Number(registration.categoryId),
        sub_category: registration.subCategory,
        address: registration.address,
        phone: registration.phone,
        whatsapp: registration.whatsapp,
        website: registration.website,
        hours: registration.hours,
        description: registration.description,
        latitude: registration.latitude || registration.cityLat || -11.7298,
        longitude: registration.longitude || registration.cityLng || -49.0678,
        maps_link: registration.mapsLink,
        city_id: registration.cityId,
        user_id: registration.userId,
        status: 'approved'
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
        } else if (error.message) {
          userMessage = `Erro no Supabase: ${error.message}`;
        }

        return res.status(400).json({ 
          error: userMessage, 
          message: error.message,
          code: error.code
        });
      }
      
      console.log("[API] Establishment registered successfully in Supabase");
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
        name: registration.name,
        category_id: Number(registration.categoryId),
        sub_category: registration.subCategory,
        address: registration.address,
        phone: registration.phone,
        whatsapp: registration.whatsapp,
        website: registration.website,
        hours: registration.hours,
        description: registration.description,
        latitude: registration.latitude || -11.7298,
        longitude: registration.longitude || -49.0678,
        city_id: Number(registration.cityId),
        user_id: registration.userId,
        rating: 5.0,
        status: 'approved',
        created_at: new Date().toISOString()
      };
      establishments.push(newEstablishment);
      console.log("[API] New establishment registered locally for user:", registration.userId, newEstablishment.name);
      
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
const rootDir = process.env.VERCEL ? path.resolve(__dirname, "..") : __dirname;
const distPath = path.resolve(rootDir, "dist");
const distExists = fs.existsSync(distPath);

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
} else if (distExists) {
  // Static serving for production (only if dist exists)
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
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
