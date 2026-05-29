import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { ocr_p1_6 } from "./ocr_p1_6";
import { ocr_p7_12 } from "./ocr_p7_12";
import { ocr_p13_18 } from "./ocr_p13_18";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Erro: Credenciais do Supabase ausentes.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Taxonomy from taxonomy.ts
const CATEGORY_MAP: Record<string, number> = {
  "Essencial": 1,
  "Segurança, Tecnologia e Suporte": 2,
  "Órgãos Públicos & Instituições": 3,
  "Beleza e Estética": 4,
  "Pet Shop": 5,
  "Automotivo": 6,
  "Casa e Construção": 7,
  "Serviços Profissionais": 8,
  "Social e Comunidade": 9,
  "Desenvolvimento Pessoal": 10,
  "Mobilidade Urbana": 11,
  "Comércio & Varejo": 12,
};

// Sort by length desc for greedy stripping
const sortedCategoryNames = Object.keys(CATEGORY_MAP).sort((a, b) => b.length - a.length);

const SUBCATEGORY_MAP: Record<string, { categoryId: number }> = {
  "Restaurante": { categoryId: 1 },
  "Lanchonete": { categoryId: 1 },
  "Pizzaria": { categoryId: 1 },
  "Supermercado / Mercado": { categoryId: 1 },
  "Padaria": { categoryId: 1 },
  "Açougue": { categoryId: 1 },
  "Hortifruti": { categoryId: 1 },
  "Distribuidora (água, gás, bebidas)": { categoryId: 1 },
  "Farmácia": { categoryId: 1 },
  "Hospital / Clínica / UPA": { categoryId: 1 },
  "Laboratório": { categoryId: 1 },
  "Hospedagem (hotel, pousada, temporada)": { categoryId: 1 },
  "Espetinho": { categoryId: 1 },
  "Peixaria": { categoryId: 1 },
  "Sorveteria/Açaiteria": { categoryId: 1 },
  "Concessionária de Energia": { categoryId: 1 },
  "Concessionária de Água": { categoryId: 1 },
  "Lavanderia": { categoryId: 1 },
  "Churrascaria": { categoryId: 1 },
  "Segurança Eletrônica / Monitoramento": { categoryId: 2 },
  "Alarmes / Câmeras": { categoryId: 2 },
  "Controle de Acesso / Portaria": { categoryId: 2 },
  "Extintores / Brigada": { categoryId: 2 },
  "Chaveiro": { categoryId: 2 },
  "Transporte Hospitalar": { categoryId: 2 },
  "Assistência Técnica (celular/informática)": { categoryId: 2 },
  "Loja de Tecnologia": { categoryId: 2 },
  "Provedor de Internet / Automação / Suporte TI": { categoryId: 2 },
  "Prefeitura / Câmara / Secretarias": { categoryId: 3 },
  "Fórum / Tribunal": { categoryId: 3 },
  "Delegacia / Polícia / Bombeiros": { categoryId: 3 },
  "Presídio / Unidade Prisional": { categoryId: 3 },
  "INSS / Receita / Órgãos Federais": { categoryId: 3 },
  "CRAS / CREAS / Conselho Tutelar": { categoryId: 3 },
  "Detran / Procon": { categoryId: 3 },
  "Correios": { categoryId: 3 },
  "Justiça Eleitoral / Junta Militar": { categoryId: 3 },
  "Coleta de Lixo / Saneamento": { categoryId: 3 },
  "Conselhos Municipais / Secretarias": { categoryId: 3 },
  "Unidade Básica de Saúde (UBS) / Posto de Saúde": { categoryId: 3 },
  "Vigilância Sanitária / Epidemiológica": { categoryId: 3 },
  "Cemitério / Velório Municipal": { categoryId: 3 },
  "Secretaria de Saúde / Educação": { categoryId: 3 },
  "Defesa Civil / Guarda Municipal": { categoryId: 3 },
  "Iluminação Pública / Semáforos": { categoryId: 3 },
  "Cartório de Notas / Registro Civil": { categoryId: 3 },
  "Justiça Federal / Trabalho / Eleitoral": { categoryId: 3 },
  "Sefaz / Receita Estadual / Municipal": { categoryId: 3 },
  "Rodoviária / Terminal Urbano": { categoryId: 3 },
  "Salão de Beleza / Barbearia": { categoryId: 4 },
  "Estética / Harmonização": { categoryId: 4 },
  "Manicure / Pedicure": { categoryId: 4 },
  "Spa / Massagem": { categoryId: 4 },
  "Tatuagem / Piercing": { categoryId: 4 },
  "Cosméticos / Perfumaria": { categoryId: 4 },
  "Pet Shop (varejo)": { categoryId: 5 },
  "Clínica Veterinária": { categoryId: 5 },
  "Banho e Tosa": { categoryId: 5 },
  "Hotel / Creche Pet": { categoryId: 5 },
  "Serviços Pet (adestramento, cuidador)": { categoryId: 5 },
  "Oficina / Centro Automotivo": { categoryId: 6 },
  "Auto Peças / Pneus": { categoryId: 6 },
  "Funilaria / Pintura": { categoryId: 6 },
  "Lava Jato": { categoryId: 6 },
  "Posto de Combustível": { categoryId: 6 },
  "Despachante / Vistoria Veicular": { categoryId: 6 },
  "Guincho / Reboque": { categoryId: 6 },
  "Auto Elétrico / Baterias": { categoryId: 6 },
  "Estética Automotiva / Martelinho": { categoryId: 6 },
  "Som, Acessórios e Insulfilm": { categoryId: 6 },
  "Autoescola / CFC": { categoryId: 6 },
  "Construção / Reforma": { categoryId: 7 },
  "Elétrica / Hidráulica": { categoryId: 7 },
  "Marcenaria / Serralheria / Vidraçaria": { categoryId: 7 },
  "Material de Construção / Ferragista": { categoryId: 7 },
  "Iluminação / Tintas / Pisos": { categoryId: 7 },
  "Energia Solar": { categoryId: 7 },
  "Limpeza / Dedetização / Mudança": { categoryId: 7 },
  "Decoração / Floricultura": { categoryId: 7 },
  "Pedreiro": { categoryId: 7 },
  "Pintor": { categoryId: 7 },
  "Marido de Aluguel / Pequenos Reparos": { categoryId: 7 },
  "Conserto de Eletrodomésticos / Fogões": { categoryId: 7 },
  "Tapeçaria / Estofados": { categoryId: 7 },
  "Armarinhos / Aviamentos / Tecidos": { categoryId: 7 },
  "Faxina / Limpeza Residencial": { categoryId: 7 },
  "Jardineiro / Piscineiro": { categoryId: 7 },
  "Instalação de Ar Condicionado": { categoryId: 7 },
  "Advocacia": { categoryId: 8 },
  "Contabilidade / Auditoria": { categoryId: 8 },
  "Consultoria Empresarial": { categoryId: 8 },
  "Imobiliária / Corretor": { categoryId: 8 },
  "Arquitetura / Engenharia / Design": { categoryId: 8 },
  "Cartório / Documentação": { categoryId: 8 },
  "Instituições Financeiras": { categoryId: 8 },
  "Fotografia / Filmagem": { categoryId: 8 },
  "Cerimonial / Eventos": { categoryId: 8 },
  "Igrejas / Templos / Comunidades Religiosas": { categoryId: 9 },
  "ONG / Associação / Sindicato": { categoryId: 9 },
  "Centro Comunitário / Grupos": { categoryId: 9 },
  "Clube / Academia / Quadra": { categoryId: 9 },
  "Espaço Cultural / Teatro / Cinema": { categoryId: 9 },
  "Eventos / Casas de Show / Bar": { categoryId: 9 },
  "Parques": { categoryId: 9 },
  "Biblioteca Pública / Museus / Monumentos": { categoryId: 9 },
  "Praça Pública / Pontos Turísticos / Mirantes": { categoryId: 9 },
  "Entretenimento Infantil / Espaço Kids": { categoryId: 9 },
  "Feira Coberta / Artesanato": { categoryId: 9 },
  "Karaokê / Boliche / Bilhar": { categoryId: 9 },
  "Pesque e Pague / Balneário": { categoryId: 9 },
  "Cinema / Teatro": { categoryId: 9 },
  "Circo / Parques de Diversão": { categoryId: 9 },
  "Campo de Futebol / Arena Beach": { categoryId: 9 },
  "Pescaria / Balneário / Clube de Lazer": { categoryId: 9 },
  "Escola (infantil ao médio)": { categoryId: 10 },
  "Universidade / Instituto Federal": { categoryId: 10 },
  "Faculdade / Escola Técnica": { categoryId: 10 },
  "Cursos Profissionalizantes / Idiomas": { categoryId: 10 },
  "Curso Preparatório / Reforço": { categoryId: 10 },
  "Mentoria / Coaching": { categoryId: 10 },
  "Escola de Artes / Esportes": { categoryId: 10 },
  "Escola Pública": { categoryId: 10 },
  "Escola Particular": { categoryId: 10 },
  "Táxi / Motorista de Aplicativo": { categoryId: 11 },
  "Mototáxi": { categoryId: 11 },
  "Transporte Escolar / Executivo": { categoryId: 11 },
  "Transporte Público (ônibus)": { categoryId: 11 },
  "Frete / Transporte de Cargas": { categoryId: 11 },
  "Locação de Veículos / Bicicletas": { categoryId: 11 },
  "Estacionamento": { categoryId: 11 },
  "Móveis / Eletrodomésticos / Eletrônicos": { categoryId: 12 },
  "Moda (feminina, masculina, infantil, fitness)": { categoryId: 12 },
  "Calçados / Ótica / Joias": { categoryId: 12 },
  "Shopping / Loja de Departamento / Outlet": { categoryId: 12 },
  "Brinquedos / Papelaria / Livraria": { categoryId: 12 },
  "Utilidades Domésticas": { categoryId: 12 },
  "Produtos Naturais / Suplementos": { categoryId: 12 },
  "Agropecuária / Variedades": { categoryId: 12 },
  "Loja de Bebê / Infantil": { categoryId: 12 },
  "Profissional Autonomo": { categoryId: 12 },
  "Alimentos": { categoryId: 12 },
  "Bazar / Brechó": { categoryId: 12 },
  "Embalagens / Descartáveis": { categoryId: 12 },
  "Loja de Variedades / Utilidades (R$ 1,99)": { categoryId: 12 },
  "Tapeçaria / Cortinas / Persianas": { categoryId: 12 },
  "Cama, Mesa e Banho": { categoryId: 12 },
};

// Sort by length desc for greedy stripping
const sortedSubCategoryNames = Object.keys(SUBCATEGORY_MAP).sort((a, b) => b.length - a.length);

async function startImport() {
  console.log("🚀 INICIANDO IMPORTAÇÃO AUTOMÁTICA...");

  // 1. Fetch cities and states to create accurate maps
  const { data: dbCities } = await supabase.from("cities").select("*");
  const { data: dbStates } = await supabase.from("states").select("*");

  const cityMap: Record<string, any> = {};
  dbCities?.forEach(c => {
    cityMap[c.name.toLowerCase()] = c;
  });

  const stateMap: Record<string, any> = {};
  dbStates?.forEach(s => {
    stateMap[s.uf.toUpperCase()] = s;
  });

  // 2. Fetch existing establishments to check for duplicates by address
  const { data: existingEsts, error: estsErr } = await supabase
    .from("establishments")
    .select("address");

  if (estsErr) {
    console.error("Erro ao buscar endereços existentes:", estsErr.message);
    process.exit(1);
  }

  const existingAddresses = new Set<string>();
  existingEsts?.forEach(est => {
    if (est.address) {
      existingAddresses.add(est.address.trim().toLowerCase());
    }
  });

  console.log(`📊 Total de endereços pré-existentes na base: ${existingAddresses.size}`);

  let parsedTotal = 0;
  let insertedTotal = 0;
  let skippedTotal = 0;

  // Process all page blocks (0 to 5)
  for (let pageIdx = 0; pageIdx < 6; pageIdx++) {
    const rawP1_6 = ocr_p1_6[pageIdx];
    const rawP7_12 = ocr_p7_12[pageIdx];
    const rawP13_18 = ocr_p13_18[pageIdx];

    const linesP1_6 = rawP1_6.split("\n").map(l => l.trim()).filter(l => l && l !== "..." && !l.startsWith("Nome"));
    const linesP7_12 = rawP7_12.split("\n").map(l => l.trim()).filter(l => l && l !== "..." && !l.startsWith("Categoria"));
    const linesP13_18 = rawP13_18.split("\n").map(l => l.trim()).filter(l => l && l !== "..." && !l.startsWith("Telefone"));

    const count = Math.min(linesP1_6.length, linesP7_12.length, linesP13_18.length);
    console.log(`\n📄 Processando Bloco ${pageIdx + 1}: ${count} linhas correspondentes calculadas.`);

    for (let i = 0; i < count; i++) {
      const lineA = linesP1_6[i];
      const lineB = linesP7_12[i];
      const lineC = linesP13_18[i];

      // Block A: Name, Latitude, Longitude
      const partsA = lineA.split(/\s+/);
      const lonStr = partsA[partsA.length - 1];
      const latStr = partsA[partsA.length - 2];
      const name = partsA.slice(0, partsA.length - 2).join(" ");

      const latitude = parseFloat(latStr.replace(",", "."));
      const longitude = parseFloat(lonStr.replace(",", "."));

      // Block B: Category, SubCategory, Address
      let categoryId = 1; // default to 1 (Essencial)
      let sub_category = "";
      let address = "";

      let remainderB = lineB;
      const categoryMatch = sortedCategoryNames.find(cat => remainderB.startsWith(cat));
      if (categoryMatch) {
        categoryId = CATEGORY_MAP[categoryMatch];
        remainderB = remainderB.slice(categoryMatch.length).trim();
      }

      const subCategoryMatch = sortedSubCategoryNames.find(sub => remainderB.startsWith(sub));
      if (subCategoryMatch) {
         sub_category = subCategoryMatch;
         address = remainderB.slice(subCategoryMatch.length).trim();
      } else {
         sub_category = remainderB;
         address = "";
      }

      // Block C: Phones, City, State, Verified
      const partsC = lineC.split(/\s+/);
      let isVerified = false;
      let stateUF = "TO";
      let cityName = "Gurupi";
      let phoneField = "";

      if (partsC.length >= 3) {
        const last = partsC[partsC.length - 1];
        isVerified = last.toLowerCase() === "sim";
        stateUF = partsC[partsC.length - 2].toUpperCase();
        cityName = partsC[partsC.length - 3];
        phoneField = partsC.slice(0, partsC.length - 3).join("");
      } else if (partsC.length === 2) {
        stateUF = partsC[partsC.length - 1].toUpperCase();
        cityName = partsC[partsC.length - 2];
      } else if (partsC.length === 1) {
        cityName = partsC[0];
      }

      // Parse Phone vs WhatsApp
      let phone = "";
      let whatsapp = "";
      if (phoneField) {
        if (phoneField.length === 21) {
          phone = phoneField.slice(0, 10);
          whatsapp = phoneField.slice(10);
        } else if (phoneField.length === 11) {
          whatsapp = phoneField;
          phone = phoneField;
        } else {
          phone = phoneField;
        }
      }

      // Lookup Database IDs for City/State
      const normalizedCity = cityName.toLowerCase();
      const cityObj = cityMap[normalizedCity] || cityMap["gurupi"];
      const city_id = cityObj?.id || 1;
      const stateObj = stateMap[stateUF] || stateMap["TO"];
      const state_id = stateObj?.id || 1;

      // Handle raw address cleanup/concatenation
      if (!address || address.length < 3) {
        address = `Gurupi, ${stateUF}`;
      }

      const cleanAddressToCheck = address.trim().toLowerCase();

      // Check for Address Duplicate
      if (existingAddresses.has(cleanAddressToCheck)) {
        skippedTotal++;
        console.log(`⚠️ Ignorado (Duplicado): "${name}" no endereço "${address}"`);
        continue;
      }

      // Map to standard Short ID
      // Generate clean/sequential format identifier
      const randomPart = Math.random().toString(36).substring(2, 6);
      const short_id = `rec-${randomPart}`;

      parsedTotal++;

      // Safe Insertion payload
      const payload = {
        name,
        category_id: categoryId,
        sub_category,
        address,
        phone: phone || null,
        whatsapp: whatsapp || null,
        hours: "Seg-Sex: 08:00-18:00",
        description: `${name} - Cadastrado manualmente e integrado.`,
        latitude,
        longitude,
        city_id,
        state_id,
        status: "approved",
        is_verified: isVerified,
        is_featured: false,
        is_premium: false,
        short_id,
        rating: 5.0,
        user_email: "alcidinopk@gmail.com"
      };

      const { data, error } = await supabase.from("establishments").insert(payload).select();

      if (error) {
        console.error(`❌ Erro ao inserir "${name}":`, error.message);
      } else {
        insertedTotal++;
        existingAddresses.add(cleanAddressToCheck); // Prevent duplicate lines in same batch
        console.log(`✅ Salvo: "${name}" | ID: ${data?.[0]?.id} | Endereço: ${address}`);
      }
    }
  }

  console.log("\n📊 RELATÓRIO FINAL DE IMPORTAÇÃO:");
  console.log(`- Total processado: ${parsedTotal}`);
  console.log(`- Total salvo no Banco: ${insertedTotal}`);
  console.log(`- Total ignorado por duplicidade de endereço: ${skippedTotal}`);
}

startImport();
