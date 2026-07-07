import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function runUpdateTest() {
  console.log("⏱️ Buscando o primeiro estabelecimento...");
  const { data: ests, error: fetchErr } = await supabase
    .from("establishments")
    .select("*")
    .limit(1);

  if (fetchErr) {
    console.error("❌ Erro ao buscar estabelecimento:", fetchErr);
    return;
  }

  if (!ests || ests.length === 0) {
    console.warn("⚠️ Nenhum estabelecimento encontrado.");
    return;
  }

  const est = ests[0];
  console.log(`✅ Estabelecimento encontrado: "${est.name}" (ID: ${est.id})`);

  // Try to perform an update like server.ts does
  const updatePayload = {
    name: est.name,
    category_id: est.category_id,
    sub_category: est.sub_category,
    address: est.address,
    phone: est.phone,
    whatsapp: est.whatsapp,
    website: est.website,
    instagram_url: est.instagram_url,
    facebook_url: est.facebook_url,
    whatsapp_url: est.whatsapp_url,
    youtube_url: est.youtube_url,
    tiktok_url: est.tiktok_url,
    linkedin_url: est.linkedin_url,
    twitter_url: est.twitter_url,
    hours: est.hours,
    is_open_24_hours: est.is_open_24_hours,
    description: est.description,
    latitude: est.latitude,
    longitude: est.longitude,
    maps_link: est.maps_link,
    plus_code: est.plus_code,
    city_id: est.city_id,
    state_id: est.state_id,
    images: est.images || [],
    tags: est.tags || '',
    featured_start: '2026-06-12T17:08:32.90458+00:00',
    featured_type: 'normal'
  };

  console.log("⏱️ Tentando atualizar com os dados originais...");
  const { data, error } = await supabase
    .from("establishments")
    .update(updatePayload)
    .eq("id", est.id)
    .select();

  if (error) {
    console.error("❌ Erro ao atualizar:", error);
    console.error("Código do erro:", error.code);
    console.error("Mensagem do erro:", error.message);
  } else {
    console.log("🎉 Sucesso ao atualizar com dados originais!", data);
  }
}

runUpdateTest();
