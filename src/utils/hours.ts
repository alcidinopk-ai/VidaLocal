
export type BusinessStatus = 'open' | 'closing_soon' | 'closed' | 'unknown';

export interface StatusInfo {
  status: BusinessStatus;
  label: string;
  color: string;
}

interface DaySchedule {
  days: number[];
  ranges: { start: number, end: number }[];
}

const DAYS_MAP: Record<string, number> = {
  'dom': 0, 'domingo': 0,
  'seg': 1, 'segunda': 1, '2ª': 1,
  'ter': 2, 'terça': 2, '3ª': 2,
  'qua': 3, 'quarta': 3, '4ª': 3,
  'qui': 4, 'quinta': 4, '5ª': 4,
  'sex': 5, 'sexta': 5, '6ª': 5,
  'sab': 6, 'sáb': 6, 'sábado': 6
};

function parseSchedules(hoursStr: string): DaySchedule[] {
  const lower = hoursStr.toLowerCase()
    .replace(/h/g, ':00')
    .replace(/às/g, '-')
    .replace(/as/g, '-')
    .replace(/ ate /g, '-')
    .replace(/ até /g, '-')
    .replace(/ e /g, ' ');

  const dayNames = Object.keys(DAYS_MAP).sort((a, b) => b.length - a.length);
  
  const tokens: { type: 'days' | 'range', value: any, index: number, length: number }[] = [];
  
  // 1. Find ranges like "seg-sex"
  const rangeRegex = new RegExp(`(${dayNames.join('|')})\\s*(?:a|-|até)\\s*(${dayNames.join('|')})`, 'g');
  let match;
  while ((match = rangeRegex.exec(lower)) !== null) {
    const start = DAYS_MAP[match[1]];
    const end = DAYS_MAP[match[2]];
    if (start !== undefined && end !== undefined) {
      const days = [];
      let d = start;
      while (d !== end) {
        days.push(d);
        d = (d + 1) % 7;
      }
      days.push(end);
      tokens.push({ type: 'days', value: days, index: match.index, length: match[0].length });
    }
  }

  // 2. Find individual day mentions, but skip those already covered by ranges
  const singleDayRegex = new RegExp(`(${dayNames.join('|')})`, 'g');
  while ((match = singleDayRegex.exec(lower)) !== null) {
    const day = DAYS_MAP[match[1]];
    if (day !== undefined) {
      const isInsideRange = tokens.some(t => t.type === 'days' && match.index >= t.index && match.index < t.index + t.length);
      if (!isInsideRange) {
        tokens.push({ type: 'days', value: [day], index: match.index, length: match[0].length });
      }
    }
  }

  // 3. Find time ranges HH:mm-HH:mm
  const timeRangeRegex = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
  while ((match = timeRangeRegex.exec(lower)) !== null) {
    const startH = parseInt(match[1]);
    const startM = parseInt(match[2]);
    const endH = parseInt(match[3]);
    const endM = parseInt(match[4]);
    let start = startH * 60 + startM;
    let end = endH * 60 + endM;
    if (end <= start) end += 24 * 60;
    tokens.push({ type: 'range', value: { start, end }, index: match.index, length: match[0].length });
  }

  tokens.sort((a, b) => a.index - b.index);

  const schedulesMap = new Map<string, DaySchedule>();
  let currentDays: number[] = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'days') {
      if (i > 0 && tokens[i-1].type === 'range') {
        currentDays = [...token.value];
      } else {
        currentDays.push(...token.value);
      }
    } else if (token.type === 'range') {
      if (currentDays.length === 0) {
        currentDays = [0, 1, 2, 3, 4, 5, 6];
      }
      
      const sortedDays = [...new Set(currentDays)].sort();
      const key = sortedDays.join(',');
      let schedule = schedulesMap.get(key);
      if (!schedule) {
        schedule = { days: sortedDays, ranges: [] };
        schedulesMap.set(key, schedule);
      }
      schedule.ranges.push(token.value);
    }
  }
  
  return Array.from(schedulesMap.values());
}

/**
 * Parses a free-text hours string and determines the current status.
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

  // 1. Check for 24h
  if (lowerHours.includes('24h') || lowerHours.includes('24 horas')) {
    return { status: 'open', label: 'Aberto 24h', color: 'text-emerald-500' };
  }

  // 2. Handle explicit "Aberto agora" or "Fechado" from AI text
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

  if (lowerHours.includes('fechado') && !lowerHours.includes('exceto')) {
    return { status: 'closed', label: 'Fechado', color: 'text-red-500' };
  }

  // Check for "Exceto" (Except)
  if (lowerHours.includes('exceto')) {
    if (lowerHours.includes('domingo') && currentDay === 0) return { status: 'closed', label: 'Fechado aos Domingos', color: 'text-red-500' };
    if (lowerHours.includes('sábado') && currentDay === 6) return { status: 'closed', label: 'Fechado aos Sábados', color: 'text-red-500' };
  }

  try {
    const schedules = parseSchedules(hoursStr);
    
    if (schedules.length === 0) {
      return { status: 'unknown', label: hoursStr, color: 'text-zinc-500' };
    }

    const todaySchedule = schedules.find(s => s.days.includes(currentDay));
    
    let isOpen = false;
    let isClosingSoon = false;

    if (todaySchedule) {
      for (const range of todaySchedule.ranges) {
        if (currentTimeInMinutes >= range.start && currentTimeInMinutes < range.end) {
          isOpen = true;
          if (range.end - currentTimeInMinutes <= 30) isClosingSoon = true;
        }
      }
    }
    
    // Check yesterday's schedule for overnight ranges
    const yesterday = (currentDay + 6) % 7;
    const yesterdaySchedule = schedules.find(s => s.days.includes(yesterday));
    if (yesterdaySchedule) {
      for (const range of yesterdaySchedule.ranges) {
        if (range.end > 24 * 60) {
          const tailStart = 0;
          const tailEnd = range.end - 24 * 60;
          if (currentTimeInMinutes >= tailStart && currentTimeInMinutes < tailEnd) {
            isOpen = true;
            if (tailEnd - currentTimeInMinutes <= 30) isClosingSoon = true;
          }
        }
      }
    }

    if (isClosingSoon) {
      return { status: 'closing_soon', label: 'Quase Fechando', color: 'text-orange-500' };
    } else if (isOpen) {
      return { status: 'open', label: 'Aberto Agora', color: 'text-emerald-500' };
    } else {
      // If days were mentioned but today is not one of them
      const allMentionedDays = new Set(schedules.flatMap(s => s.days));
      if (allMentionedDays.size > 0 && !allMentionedDays.has(currentDay)) {
         return { status: 'closed', label: 'Fechado Hoje', color: 'text-red-500' };
      }
      return { status: 'closed', label: 'Fechado', color: 'text-red-500' };
    }

  } catch (error) {
    console.error("Error parsing hours:", error);
    return { status: 'unknown', label: hoursStr, color: 'text-zinc-500' };
  }
}
