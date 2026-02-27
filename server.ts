import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { supabaseAdmin } from "./src/lib/supabase-server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

  // API Routes
  app.get("/api/states", (req, res) => {
    res.json(states);
  });

  app.get("/api/cities", (req, res) => {
    const { state_uf } = req.query;
    if (state_uf) {
      const state = states.find(s => s.uf === String(state_uf).toUpperCase());
      if (!state) return res.json([]);
      return res.json(cities.filter(c => c.state_id === state.id));
    }
    res.json(cities);
  });

  app.get("/api/cities/search", (req, res) => {
    const q = String(req.query.q || "").toLowerCase();
    if (!q) return res.json([]);

    const results = cities.filter(c => {
      const state = states.find(s => s.id === c.state_id);
      const fullName = `${c.name} ${state?.uf}`.toLowerCase();
      return fullName.includes(q) || c.name.toLowerCase().includes(q);
    });

    res.json(results);
  });

  app.post("/api/cities/resolve-by-geo", (req, res) => {
    const { lat, lng } = req.body;
    // Simple nearest city logic for demo
    let nearest = cities[0];
    let minDist = Infinity;

    cities.forEach(c => {
      const d = Math.sqrt(Math.pow(c.latitude - lat, 2) + Math.pow(c.longitude - lng, 2));
      if (d < minDist) {
        minDist = d;
        nearest = c;
      }
    });

    res.json(nearest);
  });

  // --- Intelligent Search Logic ---
  const searchIntents = [
    { id: 1, name: "Alimentação", active: true, priority: 1 },
    { id: 2, name: "Automotivo/Emergência", active: true, priority: 1 },
    { id: 3, name: "Saúde/Médico", active: true, priority: 1 },
    { id: 4, name: "Manutenção Residencial", active: true, priority: 2 },
    { id: 5, name: "Serviços Públicos", active: true, priority: 2 },
    { id: 6, name: "Beleza", active: true, priority: 3 },
    { id: 7, name: "Pets", active: true, priority: 3 },
    { id: 8, name: "Educação", active: true, priority: 3 },
    { id: 9, name: "Social/Religioso", active: true, priority: 3 },
    { id: 10, name: "Varejo/Compras", active: true, priority: 3 },
    { id: 11, name: "Transporte Público", active: true, priority: 2 },
    { id: 12, name: "Entretenimento", active: true, priority: 2 },
  ];

  const searchKeywords = [
    { intent_id: 1, keyword: "comer", weight: 10 },
    { intent_id: 1, keyword: "fome", weight: 10 },
    { intent_id: 1, keyword: "jantar", weight: 8 },
    { intent_id: 1, keyword: "lanche", weight: 8 },
    { intent_id: 1, keyword: "pizza", weight: 10 },
    { intent_id: 1, keyword: "espetinho", weight: 10 },
    { intent_id: 1, keyword: "jantinha", weight: 10 },
    { intent_id: 1, keyword: "marmita", weight: 10 },
    { intent_id: 1, keyword: "sorvete", weight: 10 },
    { intent_id: 1, keyword: "sorveteria", weight: 10 },
    { intent_id: 1, keyword: "acai", weight: 10 },
    { intent_id: 1, keyword: "açai", weight: 10 },
    { intent_id: 1, keyword: "açaiteria", weight: 10 },
    { intent_id: 1, keyword: "acaiteria", weight: 10 },
    
    { intent_id: 2, keyword: "pneu", weight: 10 },
    { intent_id: 2, keyword: "furou", weight: 10 },
    { intent_id: 2, keyword: "quebrou", weight: 8 },
    { intent_id: 2, keyword: "bateria", weight: 10 },
    { intent_id: 2, keyword: "reboque", weight: 10 },
    { intent_id: 2, keyword: "guincho", weight: 10 },
    { intent_id: 2, keyword: "borracharia", weight: 10 },
    { intent_id: 2, keyword: "mecanico", weight: 10 },
    
    { intent_id: 3, keyword: "doente", weight: 10 },
    { intent_id: 3, keyword: "febre", weight: 10 },
    { intent_id: 3, keyword: "dor", weight: 8 },
    { intent_id: 3, keyword: "remedio", weight: 10 },
    { intent_id: 3, keyword: "acidente", weight: 10 },
    { intent_id: 3, keyword: "upa", weight: 10 },
    { intent_id: 3, keyword: "farmacia", weight: 10 },
    { intent_id: 3, keyword: "laboratorio", weight: 8 },
    { intent_id: 3, keyword: "bombeiros", weight: 10 },
    
    { intent_id: 4, keyword: "vazamento", weight: 10 },
    { intent_id: 4, keyword: "encanador", weight: 10 },
    { intent_id: 4, keyword: "eletricista", weight: 10 },
    { intent_id: 4, keyword: "ar-condicionado", weight: 10 },
    
    { intent_id: 5, keyword: "delegacia", weight: 10 },
    { intent_id: 5, keyword: "forum", weight: 10 },
    { intent_id: 5, keyword: "prefeitura", weight: 10 },
    { intent_id: 5, keyword: "detran", weight: 10 },
    { intent_id: 5, keyword: "detram", weight: 10 },
    
    { intent_id: 6, keyword: "corte", weight: 10 },
    { intent_id: 6, keyword: "manicure", weight: 10 },
    { intent_id: 6, keyword: "estetica", weight: 10 },
    
    { intent_id: 7, keyword: "pet", weight: 10 },
    { intent_id: 7, keyword: "vet", weight: 10 },
    { intent_id: 7, keyword: "banho", weight: 10 },
    { intent_id: 7, keyword: "tosa", weight: 10 },
    
    { intent_id: 8, keyword: "curso", weight: 10 },
    { intent_id: 8, keyword: "escola", weight: 10 },
    { intent_id: 8, keyword: "reforço", weight: 10 },
    { intent_id: 8, keyword: "faculdade", weight: 10 },
    
    { intent_id: 9, keyword: "igreja", weight: 10 },
    { intent_id: 9, keyword: "evento", weight: 10 },
    { intent_id: 9, keyword: "cultura", weight: 10 },
    
    { intent_id: 10, keyword: "comprar", weight: 10 },
    { intent_id: 10, keyword: "roupa", weight: 10 },
    { intent_id: 10, keyword: "moveis", weight: 10 },
    { intent_id: 10, keyword: "celular", weight: 10 },
    { intent_id: 10, keyword: "presente", weight: 10 },

    { intent_id: 11, keyword: "onibus", weight: 10 },
    { intent_id: 11, keyword: "ônibus", weight: 10 },
    { intent_id: 11, keyword: "terminal", weight: 10 },
    { intent_id: 11, keyword: "circular", weight: 8 },
    { intent_id: 11, keyword: "passagem", weight: 8 },
    { intent_id: 11, keyword: "linha", weight: 7 },
    { intent_id: 11, keyword: "transporte", weight: 9 },

    { intent_id: 12, keyword: "cinema", weight: 10 },
    { intent_id: 12, keyword: "teatro", weight: 10 },
    { intent_id: 12, keyword: "show", weight: 10 },
    { intent_id: 12, keyword: "diversao", weight: 9 },
    { intent_id: 12, keyword: "diversão", weight: 9 },
    { intent_id: 12, keyword: "parque", weight: 10 },
    { intent_id: 12, keyword: "lazer", weight: 9 },
    { intent_id: 12, keyword: "balada", weight: 10 },
    { intent_id: 12, keyword: "festa", weight: 10 },
  ];

  const intentTypeMap = [
    { intent_id: 1, type: "Alimentação", weight: 10 },
    { intent_id: 1, type: "Delivery", weight: 8 },
    { intent_id: 1, type: "Sorveteria/Açaiteria", weight: 10 },
    { intent_id: 2, type: "Oficina", weight: 10 },
    { intent_id: 2, type: "Auto Peças", weight: 8 },
    { intent_id: 2, type: "Guincho", weight: 10 },
    { intent_id: 3, type: "Hospital", weight: 10 },
    { intent_id: 3, type: "Farmácia", weight: 10 },
    { intent_id: 3, type: "Laboratório", weight: 8 },
    { intent_id: 3, type: "Bombeiros", weight: 5 },
    { intent_id: 11, type: "Transporte Público (ônibus)", weight: 10 },
    { intent_id: 12, type: "Espaço Cultural / Teatro / Cinema", weight: 10 },
    { intent_id: 12, type: "Eventos / Casas de Show / Bar", weight: 10 },
    { intent_id: 12, type: "Parques", weight: 8 },
  ];

  const normalize = (text: string) => 
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  app.get("/api/search/suggest", (req, res) => {
    const q = normalize(String(req.query.q || ""));
    if (!q) return res.json({ intents: [], types: [] });

    const scores: Record<number, number> = {};
    searchKeywords.forEach(kw => {
      if (q.includes(normalize(kw.keyword))) {
        scores[kw.intent_id] = (scores[kw.intent_id] || 0) + kw.weight;
      }
    });

    const topIntents = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => searchIntents.find(i => i.id === Number(id)));

    const suggestedTypes = intentTypeMap
      .filter(m => topIntents.some(i => i?.id === m.intent_id))
      .map(m => m.type);

    res.json({
      intents: topIntents.filter(Boolean),
      types: [...new Set(suggestedTypes)].slice(0, 8)
    });
  });

  app.get("/api/search", (req, res) => {
    const q = normalize(String(req.query.q || ""));
    const { city_id, lat, lng } = req.query;

    // Baseline ranking logic
    let results = cities.filter(c => {
      const state = states.find(s => s.id === c.state_id);
      const fullName = normalize(`${c.name} ${state?.uf}`);
      return fullName.includes(q) || normalize(c.name).includes(q);
    });

    // In a real app, we'd search establishments table here
    // For now, we return cities as "places" for demo purposes
    res.json(results);
  });

  app.post("/api/search/log", (req, res) => {
    console.log("Search Log:", req.body);
    res.json({ status: "ok" });
  });

  app.post("/api/establishments/register", async (req, res) => {
    const registration = req.body;
    console.log("New Establishment Registration Request (Pending Validation):", registration);
    
    try {
      // Try to save to Supabase if configured
      if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { error } = await supabaseAdmin
          .from('establishments')
          .insert([{
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
            status: 'pending'
          }]);

        if (error) throw error;
      }

      res.json({ 
        status: "pending", 
        message: "Sua solicitação foi recebida e está aguardando validação administrativa." 
      });
    } catch (error) {
      console.error("Supabase Error:", error);
      // Fallback to success even if DB fails for demo purposes, 
      // but in production we'd handle this differently.
      res.json({ 
        status: "pending", 
        message: "Sua solicitação foi recebida (localmente) e está aguardando validação." 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
