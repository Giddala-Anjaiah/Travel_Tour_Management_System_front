export const WEATHER_CODES = {
  0: { label: 'Clear sky', icon: 'Sun' },
  1: { label: 'Mainly clear', icon: 'Sun' },
  2: { label: 'Partly cloudy', icon: 'CloudSun' },
  3: { label: 'Overcast', icon: 'Cloud' },
  45: { label: 'Fog', icon: 'CloudFog' },
  48: { label: 'Depositing rime fog', icon: 'CloudFog' },
  51: { label: 'Light drizzle', icon: 'CloudDrizzle' },
  53: { label: 'Moderate drizzle', icon: 'CloudDrizzle' },
  55: { label: 'Dense drizzle', icon: 'CloudDrizzle' },
  56: { label: 'Light freezing drizzle', icon: 'CloudDrizzle' },
  57: { label: 'Dense freezing drizzle', icon: 'CloudDrizzle' },
  61: { label: 'Slight rain', icon: 'CloudRain' },
  63: { label: 'Moderate rain', icon: 'CloudRain' },
  65: { label: 'Heavy rain', icon: 'CloudRain' },
  66: { label: 'Light freezing rain', icon: 'CloudRain' },
  67: { label: 'Heavy freezing rain', icon: 'CloudRain' },
  71: { label: 'Slight snow fall', icon: 'CloudSnow' },
  73: { label: 'Moderate snow fall', icon: 'CloudSnow' },
  75: { label: 'Heavy snow fall', icon: 'CloudSnow' },
  77: { label: 'Snow grains', icon: 'CloudSnow' },
  80: { label: 'Slight rain showers', icon: 'CloudRain' },
  81: { label: 'Moderate rain showers', icon: 'CloudRain' },
  82: { label: 'Violent rain showers', icon: 'CloudRain' },
  85: { label: 'Slight snow showers', icon: 'CloudSnow' },
  86: { label: 'Heavy snow showers', icon: 'CloudSnow' },
  95: { label: 'Thunderstorm', icon: 'CloudLightning' },
  96: { label: 'Thunderstorm with slight hail', icon: 'CloudLightning' },
  99: { label: 'Thunderstorm with heavy hail', icon: 'CloudLightning' },
};

export function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { label: 'Unknown', icon: 'Cloud' };
}

export function formatTemperature(temp) {
  return `${Math.round(temp)}°C`;
}

export function formatWindSpeed(speed) {
  return `${Math.round(speed)} km/h`;
}

export function formatHumidity(humidity) {
  return `${humidity}%`;
}

export function formatTime(timestamp, timezone = 'UTC') {
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });
  } catch {
    return '--:--';
  }
}

export function formatDate(timestamp, timezone = 'UTC') {
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    });
  } catch {
    return 'Unknown';
  }
}

const weatherCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000;

export function getCachedWeather(key) {
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

export function setCachedWeather(key, data) {
  weatherCache.set(key, { data, timestamp: Date.now() });
}

export async function fetchWeather(latitude, longitude, timezone = 'auto') {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = getCachedWeather(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone,
    forecast_days: '3',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  setCachedWeather(cacheKey, data);
  return data;
}