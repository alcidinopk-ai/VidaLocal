import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function runDirectUpdate() {
  console.log("🚀 Iniciando atualização manual direta com alta precisão...");

  const updates = [
    {
      id: "12543e91-20b7-4b0d-8a01-a04dc2bb0065",
      name: "Posto Central",
      lat: -11.728956,
      lng: -49.066453
    },
    {
      id: "10851803-2bf1-40aa-bb0a-9abc27dd4ac9",
      name: "Posto Décio Gurupi",
      lat: -11.749520,
      lng: -49.091210
    },
    {
      id: "caafc65e-9fc4-4707-8a05-a22a9c11a661",
      name: "Posto Petrobras",
      lat: -11.741289,
      lng: -49.076899
    },
    {
      id: "a328e6cd-bb81-4bff-9319-3c08f35d330b",
      name: "Posto Ipiranga",
      lat: -11.734890,
      lng: -49.071120
    }
  ];

  for (const item of updates) {
    console.log(`⏳ Atualizando "${item.name}" -> (${item.lat}, ${item.lng})...`);
    
    const { error } = await supabase
      .from("establishments")
      .update({
        latitude: item.lat,
        longitude: item.lng
      })
      .eq("id", item.id);

    if (error) {
      console.error(`❌ Erro ao atualizar "${item.name}":`, error.message);
    } else {
      console.log(`✅ "${item.name}" atualizado com sucesso!`);
    }
  }

  console.log("\n🚀 Todos os postos foram atualizados com coordenadas precisas no Supabase!");
}

runDirectUpdate();
