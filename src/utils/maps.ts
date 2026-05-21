// Helper to extract coordinates from Google Maps Link
export const extractCoordinatesFromMapsLink = (url: string) => {
  if (!url) return null;
  try {
    // 1. Exact place pinpoint/marker pattern (e.g., !3d-11.7288125!4d-49.0688375)
    const pinpointLatMatch = url.match(/!3d(-?\d+(?:[\.,]\d+)?)/);
    const pinpointLngMatch = url.match(/!4d(-?\d+(?:[\.,]\d+)?)/);
    if (pinpointLatMatch && pinpointLngMatch) {
      return {
        latitude: parseFloat(pinpointLatMatch[1].replace(',', '.')),
        longitude: parseFloat(pinpointLngMatch[1].replace(',', '.'))
      };
    }

    // 2. Standard viewport center pattern: /@latitude,longitude,zoom
    const atRegex = /@(-?\d+(?:[\.,]\d+)?),(-?\d+(?:[\.,]\d+)?)/;
    const atMatch = url.match(atRegex);
    if (atMatch) {
      return {
        latitude: parseFloat(atMatch[1].replace(',', '.')),
        longitude: parseFloat(atMatch[2].replace(',', '.'))
      };
    }

    // 3. Query/Params pattern: q=latitude,longitude or ll=latitude,longitude or query=latitude,longitude
    const queryRegex = /[?&](?:q|query|ll|saddr|daddr)=(-?\d+(?:[\.,]\d+)?),(-?\d+(?:[\.,]\d+)?)/;
    const queryMatch = url.match(queryRegex);
    if (queryMatch) {
      return {
        latitude: parseFloat(queryMatch[1].replace(',', '.')),
        longitude: parseFloat(queryMatch[2].replace(',', '.'))
      };
    }
  } catch (err) {
    console.error("Error parsing Google Maps URL:", err);
  }
  return null;
};

// Helper to construct a Google Maps Directions URL (routing) using extracted or default coordinates
export const getDirectionsUrl = (
  mapsLink?: string | null,
  latitude?: number | null,
  longitude?: number | null,
  userLocation?: { latitude: number; longitude: number } | null
): string => {
  let destLat = latitude;
  let destLng = longitude;

  if (mapsLink) {
    const coords = extractCoordinatesFromMapsLink(mapsLink);
    if (coords) {
      destLat = coords.latitude;
      destLng = coords.longitude;
    }
  }

  if (destLat && destLng) {
    const originParam = userLocation ? `&origin=${userLocation.latitude},${userLocation.longitude}` : '';
    return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}${originParam}`;
  }

  return mapsLink || '#';
};
