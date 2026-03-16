
export type BusinessStatus = 'open' | 'closing_soon' | 'closed' | 'unknown';

export interface StatusInfo {
  status: BusinessStatus;
  label: string;
  color: string;
}

/**
 * Parses a free-text hours string and determines the current status.
 * This is a heuristic approach since the input is free-text.
 * Expected format examples: 
 * - "08:00 - 18:00"
 * - "Seg-Sex: 08h às 18h"
 * - "08:00 às 12:00, 14:00 às 18:00"
 */
export function getBusinessStatus(hoursStr: string | undefined | null): StatusInfo {
  if (!hoursStr || hoursStr.trim() === '') {
    return { status: 'unknown', label: 'Horário não informado', color: 'text-zinc-400' };
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0 (Dom) to 6 (Sáb)
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const lowerHours = hoursStr.toLowerCase();

  // 1. Check for specific day exclusions/inclusions
  const daysMap: Record<string, number> = {
    'dom': 0, 'domingo': 0,
    'seg': 1, 'segunda': 1, '2ª': 1,
    'ter': 2, 'terça': 2, '3ª': 2,
    'qua': 3, 'quarta': 3, '4ª': 3,
    'qui': 4, 'quinta': 4, '5ª': 4,
    'sex': 5, 'sexta': 5, '6ª': 5,
    'sab': 6, 'sáb': 6, 'sábado': 6
  };

  // Heuristic for day ranges like "Seg-Sex" or "Segunda a Sábado"
  const rangeMatch = lowerHours.match(/(seg|ter|qua|qui|sex|sab|dom|segunda|terça|quarta|quinta|sexta|sábado|domingo)\s*(?:a|-|até)\s*(seg|ter|qua|qui|sex|sab|dom|segunda|terça|quarta|quinta|sexta|sábado|domingo)/);
  
  if (rangeMatch) {
    const startDay = daysMap[rangeMatch[1].substring(0, 3)];
    const endDay = daysMap[rangeMatch[2].substring(0, 3)];
    
    if (startDay !== undefined && endDay !== undefined) {
      let isWithinDays = false;
      if (startDay <= endDay) {
        isWithinDays = currentDay >= startDay && currentDay <= endDay;
      } else {
        // Range crosses weekend, e.g., Sex-Seg (5, 6, 0, 1)
        isWithinDays = currentDay >= startDay || currentDay <= endDay;
      }
      
      if (!isWithinDays) {
        return { status: 'closed', label: 'Fechado Hoje', color: 'text-red-500' };
      }
    }
  }

  // Check for "Exceto" (Except)
  if (lowerHours.includes('exceto')) {
    if (lowerHours.includes('domingo') && currentDay === 0) return { status: 'closed', label: 'Fechado aos Domingos', color: 'text-red-500' };
    if (lowerHours.includes('sábado') && currentDay === 6) return { status: 'closed', label: 'Fechado aos Sábados', color: 'text-red-500' };
  }

  // 2. Check for 24h
  if (lowerHours.includes('24h') || lowerHours.includes('24 horas')) {
    return { status: 'open', label: 'Aberto 24h', color: 'text-emerald-500' };
  }

  // 3. Handle explicit "Aberto agora" or "Fechado" from AI text
  if (lowerHours.includes('aberto agora') || lowerHours.includes('aberto até')) {
    if (lowerHours.includes('até')) {
      const timeMatch = lowerHours.match(/(\d{1,2})[:h](\d{2})?/);
      if (timeMatch) {
        const endHour = parseInt(timeMatch[1]);
        const endMin = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const endTimeInMinutes = endHour * 60 + endMin;
        
        if (endTimeInMinutes - currentTimeInMinutes > 0 && endTimeInMinutes - currentTimeInMinutes <= 30) {
          return { status: 'closing_soon', label: 'Quase Fechando', color: 'text-orange-500' };
        }
      }
    }
    return { status: 'open', label: 'Aberto Agora', color: 'text-emerald-500' };
  }

  if (lowerHours.includes('fechado')) {
    return { status: 'closed', label: 'Fechado', color: 'text-red-500' };
  }

  try {
    // Normalize string: replace 'h' with ':00', 'às' with '-', etc.
    let normalized = hoursStr.toLowerCase()
      .replace(/h/g, ':00')
      .replace(/às/g, '-')
      .replace(/as/g, '-')
      .replace(/ ate /g, '-')
      .replace(/ até /g, '-')
      .replace(/\s+/g, '');

    // Extract all time patterns like HH:mm
    const timeRegex = /(\d{1,2}):(\d{2})/g;
    const matches = [...normalized.matchAll(timeRegex)];

    if (matches.length < 2) {
      return { status: 'unknown', label: hoursStr, color: 'text-zinc-500' };
    }

    let isOpen = false;
    let isClosingSoon = false;

    for (let i = 0; i < matches.length; i += 2) {
      if (i + 1 >= matches.length) break;

      const startHour = parseInt(matches[i][1]);
      const startMin = parseInt(matches[i][2]);
      const endHour = parseInt(matches[i+1][1]);
      const endMin = parseInt(matches[i+1][2]);

      const startTimeInMinutes = startHour * 60 + startMin;
      let endTimeInMinutes = endHour * 60 + endMin;

      if (endTimeInMinutes <= startTimeInMinutes) {
        endTimeInMinutes += 24 * 60;
      }

      if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes) {
        isOpen = true;
        if (endTimeInMinutes - currentTimeInMinutes <= 30) {
          isClosingSoon = true;
        }
      }
      
      const currentTimePlus24 = currentTimeInMinutes + 24 * 60;
      if (currentTimePlus24 >= startTimeInMinutes && currentTimePlus24 < endTimeInMinutes) {
        isOpen = true;
        if (endTimeInMinutes - currentTimePlus24 <= 30) {
          isClosingSoon = true;
        }
      }
    }

    if (isClosingSoon) {
      return { status: 'closing_soon', label: 'Quase Fechando', color: 'text-orange-500' };
    } else if (isOpen) {
      return { status: 'open', label: 'Aberto Agora', color: 'text-emerald-500' };
    } else {
      return { status: 'closed', label: 'Fechado', color: 'text-red-500' };
    }

  } catch (error) {
    console.error("Error parsing hours:", error);
    return { status: 'unknown', label: hoursStr, color: 'text-zinc-500' };
  }
}
