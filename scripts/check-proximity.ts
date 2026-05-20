import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function checkProximity() {
  const { data, error } = await supabase
    .from("establishments")
    .select(`
      id,
      name,
      latitude,
      longitude,
      cities (
        name,
        latitude,
        longitude
      )
    `);

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  let totalUUID = 0;
  let closeToCenter = 0;
  const sampleArr: any[] = [];

  for (const item of data || []) {
    const isAuto = item.id.includes("-") && item.id.length > 10;
    if (!isAuto) continue;

    totalUUID++;
    const cityInfo: any = item.cities;
    if (cityInfo && cityInfo.latitude && cityInfo.longitude) {
      const cityLat = Number(cityInfo.latitude);
      const cityLng = Number(cityInfo.longitude);
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);

      const diffLat = Math.abs(lat - cityLat);
      const diffLng = Math.abs(lng - cityLng);

      // Within roughly 1km (0.01 degrees) of the city center coordinates
      if (diffLat < 0.01 && diffLng < 0.01) {
        closeToCenter++;
        sampleArr.push({
          id: item.id,
          name: item.name,
          lat,
          lng,
          cityName: cityInfo.name
        });
      }
    }
  }

  console.log(`\n📊 Total de Estabelecimentos UUID (Auto): ${totalUUID}`);
  console.log(`📍 Dos quais próximos ao centro da cidade (< 0.01 graus): ${closeToCenter}`);
  console.log("Amostra de 15 itens próximos ao centro:\n", JSON.stringify(sampleArr.slice(0, 15), null, 2));
}

checkProximity();
