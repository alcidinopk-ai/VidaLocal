import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { supabaseAdmin } from "./src/lib/supabase-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

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
  { id: "e1", name: "Espetinho do Adão B13", category_id: 1, sub_category: "Espetinho", address: "Av. Goiás, 1234, Centro", city_id: 1, latitude: -11.7300, longitude: -49.0680, rating: 4.8, whatsapp: "63999991234" },
  { id: "e2", name: "Delicias da Polly", category_id: 1, sub_category: "Alimentação (restaurante, lanchonete, pizzaria)", address: "Rua 7, 456, Setor Central", city_id: 1, latitude: -11.7285, longitude: -49.0665, rating: 4.9, whatsapp: "63999995678" },
  { id: "e3", name: "Mecânica do João", category_id: 6, sub_category: "Oficina / Centro Automotivo", address: "Av. Maranhão, 789", city_id: 1, latitude: -11.7315, longitude: -49.0695, rating: 4.5, whatsapp: "63999990000" },
  { id: "e4", name: "Pet Shop AuAu", category_id: 5, sub_category: "Pet Shop (varejo)", address: "Rua 10, 101", city_id: 1, latitude: -11.7270, longitude: -49.0650, rating: 4.7, whatsapp: "63999991111" },
];

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/states", (req, res) => res.json(states));

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
  let nearest = cities[0];
  let minDist = Infinity;
  cities.forEach(c => {
    const d = Math.sqrt(Math.pow(c.latitude - lat, 2) + Math.pow(c.longitude - lng, 2));
    if (d < minDist) { minDist = d; nearest = c; }
  });
  res.json(nearest);
});

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

app.get("/api/search", (req, res) => {
  const q = normalize(String(req.query.q || ""));
  const { city_id } = req.query;
  let results = establishments.filter(e => {
    const matchName = normalize(e.name).includes(q);
    const matchSub = normalize(e.sub_category).includes(q);
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
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

// Only listen if not on Vercel
if (!process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

export default app;
