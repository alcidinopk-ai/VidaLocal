import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "./src/lib/supabase-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Initialize Gemini on the server
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

const establishments = [
  { id: "e1", name: "Espetinho do Adão B13", category_id: 1, sub_category: "Espetinho", address: "Av. Maranhão, 1438, Centro, Gurupi - TO", city_id: 1, latitude: -11.7289, longitude: -49.0692, rating: 4.8, whatsapp: "63984551234" },
  { id: "e2", name: "Delicias da Polly", category_id: 1, sub_category: "Alimentação (restaurante, lanchonete, pizzaria)", address: "Rua 7, 1245, Centro, Gurupi - TO", city_id: 1, latitude: -11.7275, longitude: -49.0660, rating: 4.9, whatsapp: "63992334455" },
  { id: "e3", name: "Mecânica do Neném", category_id: 6, sub_category: "Oficina / Centro Automotivo", address: "Av. Maranhão, 2560, Setor Industrial, Gurupi - TO", city_id: 1, latitude: -11.7350, longitude: -49.0720, rating: 4.5, whatsapp: "63984112233" },
  { id: "e4", name: "Pet Shop Amigão", category_id: 5, sub_category: "Pet Shop (varejo)", address: "Av. Goiás, 2100, Centro, Gurupi - TO", city_id: 1, latitude: -11.7320, longitude: -49.0685, rating: 4.7, whatsapp: "63999887766" },
];

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
      const { data, error } = await supabaseAdmin
        .from('cities')
        .select('*, states!inner(uf)')
        .or(`name.ilike.%${q}%,states.uf.ilike.%${q}%`)
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
        return res.json({ ...nearest, uf: nearest.states?.uf });
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

app.post("/api/chat", async (req, res) => {
  const { message, city, userLocation, localContext, taxonomyContext } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ 
      error: "GEMINI_API_KEY não configurada no servidor.",
      role: "model",
      text: "Erro de configuração: A chave da API Gemini não foi encontrada no servidor. Por favor, configure-a nas variáveis de ambiente da Vercel."
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: `Você é VidaLocal, um assistente de guia urbano premium para a cidade de ${city.name}-${city.uf}. 
        Quando os usuários perguntarem sobre lugares, serviços ou empresas, você DEVE fornecer uma lista estruturada de opções relevantes.
        Para cada empresa, inclua: 1. Nome, 2. Endereço Completo, 3. Número de Telefone (se disponível), e 4. Uma breve descrição.
        Use listas Markdown para clareza. Sempre priorize a precisão e os dados em tempo real do Google Maps.
        
        ${taxonomyContext}
        
        ${localContext ? `IMPORTANTE: Os seguintes estabelecimentos foram encontrados em nossa base de dados local e DEVEM ser mencionados com destaque se forem relevantes para a pergunta:
        ${localContext}` : ""}
        
        Sempre tente enquadrar os estabelecimentos encontrados nas categorias e tipos acima.`,
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: userLocation?.latitude || city.latitude,
              longitude: userLocation?.longitude || city.longitude,
            },
          },
        },
      },
    });

    const text = response.text || "Não consegui encontrar uma resposta para isso.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as any[];
    
    const groundingChunks = chunks?.map(chunk => ({
      maps: chunk.maps ? { 
        uri: chunk.maps.uri, 
        title: chunk.maps.title,
        location: chunk.maps.location ? {
          latitude: chunk.maps.location.latitude,
          longitude: chunk.maps.location.longitude
        } : undefined
      } : undefined,
      web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
    })).filter(c => c.maps || c.web) || [];

    res.json({
      role: "model",
      text,
      groundingChunks,
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorString = JSON.stringify(error).toLowerCase();
    const isRateLimit = 
      errorString.includes("429") || 
      errorString.includes("resource_exhausted") ||
      errorString.includes("quota exceeded");

    res.json({
      role: "model",
      text: isRateLimit 
        ? "Desculpe, o serviço está temporariamente sobrecarregado devido ao alto volume de buscas. Por favor, tente novamente em alguns instantes."
        : "Desculpe, encontrei um erro ao processar sua solicitação. Por favor, tente novamente.",
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
  const { city_id } = req.query;
  
  try {
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      let query = supabaseAdmin.from('establishments').select('*').eq('status', 'approved');
      if (city_id) {
        query = query.eq('city_id', Number(city_id));
      }
      query = query.or(`name.ilike.%${q}%,sub_category.ilike.%${q}%,description.ilike.%${q}%`);
      
      const { data, error } = await query.limit(20);
      if (error) throw error;
      
      if (data && data.length > 0) {
        return res.json(data);
      }

      // If no establishments, try searching cities
      const { data: cityData } = await supabaseAdmin
        .from('cities')
        .select('*, states(uf)')
        .ilike('name', `%${q}%`)
        .eq('active', true);
      
      return res.json(cityData?.map(c => ({ ...c, uf: c.states?.uf })) || []);
    }

    let results = establishments.filter(e => {
      const normName = normalize(e.name);
      const normSub = normalize(e.sub_category);
      
      const matchName = q.includes(normName) || normName.includes(q);
      const matchSub = q.includes(normSub) || normSub.includes(q);
      
      const matchCity = city_id ? e.city_id === Number(city_id) : true;
      return (matchName || matchSub) && matchCity;
    });
    if (results.length === 0) {
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

app.get("/api/establishments/user/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId || userId === 'undefined' || userId === 'null') return res.json([]);
  try {
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      const { data, error } = await supabaseAdmin.from('establishments').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      return res.json(data || []);
    }
    res.json([]);
  } catch (error) {
    console.error("Error fetching user establishments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/establishments/register", async (req, res) => {
  const registration = req.body;
  try {
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_URL.includes('placeholder')) {
      const { error } = await supabaseAdmin.from('establishments').insert([{
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
        city_id: registration.cityId,
        user_id: registration.userId,
        status: 'pending'
      }]);
      if (error) throw error;
    }
    res.json({ status: "pending", message: "Sua solicitação foi recebida e está aguardando validação administrativa." });
  } catch (error) {
    console.error("Supabase Error:", error);
    res.json({ status: "pending", message: "Sua solicitação foi recebida (localmente) e está aguardando validação." });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

// Only listen if not on Vercel
if (!process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

export default app;
