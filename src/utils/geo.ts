/**
 * Fórmula de Haversine (ou biblioteca geoespacial equivalente).
 * Retorna a distância oficial em quilômetros entre dois pontos geoespaciais (lat/lng).
 */
export const calculateHaversineDistance = (
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return Infinity;
  }
  
  const pLat1 = Number(lat1);
  const pLon1 = Number(lon1);
  const pLat2 = Number(lat2);
  const pLon2 = Number(lon2);

  if (isNaN(pLat1) || isNaN(pLon1) || isNaN(pLat2) || isNaN(pLon2)) {
    return Infinity;
  }

  const R = 6371; // Raio da Terra em km
  const dLat = (pLat2 - pLat1) * (Math.PI / 180);
  const dLon = (pLon2 - pLon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pLat1 * (Math.PI / 180)) * Math.cos(pLat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Formata a distância para exibição nos cards.
 * Exemplo de retorno: "📍 42 m", "📍 180 m", "📍 850 m", "📍 1,2 km", "📍 3,8 km"
 */
export const formatDistance = (distInKm?: number | null, withIcon: boolean = true): string => {
  if (distInKm == null || !isFinite(distInKm) || distInKm >= 99999) {
    return withIcon ? "📍 ---" : "---";
  }

  const prefix = withIcon ? "📍 " : "";
  if (distInKm < 1) {
    const meters = Math.round(distInKm * 1000);
    return `${prefix}${meters} m`;
  }
  const kmFormatted = distInKm.toFixed(1).replace('.', ',');
  return `${prefix}${kmFormatted} km`;
};

/**
 * Ordena obrigatoriamente TODOS os estabelecimentos por distância crescente.
 * Nunca influenciada por data de cadastro, destaque, avaliação, nome, ID, ou popularidade.
 */
export const sortByDistanceAsc = <T extends { latitude?: number; longitude?: number; distance?: number }>(
  items: T[],
  userLat?: number,
  userLon?: number
): (T & { distance: number; formattedDistance: string })[] => {
  const calculated = items.map(item => {
    let dist = item.distance;
    if (userLat != null && userLon != null && item.latitude != null && item.longitude != null) {
      dist = calculateHaversineDistance(userLat, userLon, item.latitude, item.longitude);
    } else if (dist == null) {
      dist = Infinity;
    }
    return {
      ...item,
      distance: dist,
      formattedDistance: formatDistance(dist, true)
    };
  });

  return calculated.sort((a, b) => {
    if (isFinite(a.distance) && isFinite(b.distance)) {
      return a.distance - b.distance;
    }
    if (isFinite(a.distance) && !isFinite(b.distance)) return -1;
    if (!isFinite(a.distance) && isFinite(b.distance)) return 1;
    return 0;
  });
};

/**
 * Requisito 1: Auditoria das Coordenadas dos Estabelecimentos
 * Verifica todos os registros cadastrados e identifica problemas.
 */
export const auditEstablishmentsCoordinates = (
  establishments: any[],
  city?: { name?: string; uf?: string; latitude?: number; longitude?: number }
) => {
  let missingLat = 0;
  let missingLng = 0;
  let invalidCoords = 0;
  let invertedCoords = 0;
  let duplicateCoords = 0;
  let outsideCity = 0;
  let validRecords = 0;

  const coordMap = new Set<string>();

  establishments.forEach(est => {
    const lat = est.latitude;
    const lng = est.longitude;

    if (lat === undefined || lat === null) {
      missingLat++;
      return;
    }
    if (lng === undefined || lng === null) {
      missingLng++;
      return;
    }

    const nLat = Number(lat);
    const nLng = Number(lng);

    if (isNaN(nLat) || isNaN(nLng) || nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
      invalidCoords++;
      return;
    }

    // No Brasil, a latitude costuma ficar entre 5 e -35, e a longitude entre -35 e -74.
    // Se lat estiver fora desse range de latitude e dentro do range de longitude, pode estar invertido.
    if ((nLat < -35 || nLat > 5) && (nLng >= -35 && nLng <= 5)) {
      invertedCoords++;
      return;
    }

    const coordKey = `${nLat.toFixed(5)}_${nLng.toFixed(5)}`;
    if (coordMap.has(coordKey)) {
      duplicateCoords++;
    } else {
      coordMap.add(coordKey);
    }

    // Checar se está muito longe do centro da cidade (> 100km)
    if (city?.latitude && city?.longitude) {
      const distFromCity = calculateHaversineDistance(nLat, nLng, city.latitude, city.longitude);
      if (distFromCity > 100) {
        outsideCity++;
      }
    }

    validRecords++;
  });

  const totalInvalid = missingLat + missingLng + invalidCoords + invertedCoords;

  console.group("📍 [GEO AUDITORIA] Coordenadas dos Estabelecimentos");
  console.log(`Total de registros analisados: ${establishments.length}`);
  console.log(`✅ Registros válidos: ${validRecords}`);
  console.log(`❌ Registros inválidos: ${totalInvalid}`);
  console.log(`  - Latitude ausente: ${missingLat}`);
  console.log(`  - Longitude ausente: ${missingLng}`);
  console.log(`  - Coordenadas inválidas: ${invalidCoords}`);
  console.log(`  - Latitude e Longitude invertidas: ${invertedCoords}`);
  console.log(`⚠️ Coordenadas duplicadas: ${duplicateCoords}`);
  if (city?.name) {
    console.log(`⚠️ Fora do município (${city.name} - ${city.uf || ''}): ${outsideCity}`);
  }
  console.groupEnd();

  return {
    total: establishments.length,
    valid: validRecords,
    invalid: totalInvalid,
    missingLat,
    missingLng,
    invalidCoords,
    invertedCoords,
    duplicateCoords,
    outsideCity
  };
};

/**
 * Requisito 2 e 9: Auditoria da Localização do Usuário & Logs Temporários
 */
export const auditUserLocationLog = (
  lat: number,
  lng: number,
  accuracy?: number,
  cityName?: string,
  extraDetails?: { analyzedCount?: number; sampleDistances?: string[] }
) => {
  console.group("🧭 [GEO AUDITORIA] Localização do Usuário (GPS Real)");
  console.log(`• Latitude: ${lat}`);
  console.log(`• Longitude: ${lng}`);
  console.log(`• Precisão do GPS: ${accuracy ? `${Math.round(accuracy)} metros` : 'Não informada'}`);
  console.log(`• Cidade detectada: ${cityName || 'Desconhecida'}`);
  console.log(`• Horário da atualização: ${new Date().toLocaleTimeString('pt-BR')}`);
  if (extraDetails?.analyzedCount !== undefined) {
    console.log(`• Quantidade de estabelecimentos analisados: ${extraDetails.analyzedCount}`);
  }
  if (extraDetails?.sampleDistances && extraDetails.sampleDistances.length > 0) {
    console.log(`• Ordem final (Top 5 distâncias):`, extraDetails.sampleDistances.slice(0, 5));
  }
  console.groupEnd();
};
