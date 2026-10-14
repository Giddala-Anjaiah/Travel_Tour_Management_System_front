import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWeather, getWeatherInfo, formatTemperature, formatWindSpeed, formatHumidity, formatTime, formatDate } from '../utils/weather';
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudDrizzle, CloudSun, Droplets, Wind, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const ICON_MAP = {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
  CloudSun,
};

function WeatherIcon({ code, className = 'h-8 w-8' }) {
  const { icon } = getWeatherInfo(code);
  const Icon = ICON_MAP[icon] || Cloud;
  return <Icon className={className} />;
}

function WeatherComponent({ latitude, longitude, destination, timezone = 'auto' }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const abortRef = useRef(null);

  const loadWeather = useCallback(async () => {
    if (!latitude || !longitude) {
      setError('Coordinates not available');
      setLoading(false);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const data = await fetchWeather(latitude, longitude, timezone);
      if (!abortRef.current.signal.aborted) {
        setWeather(data);
      }
    } catch (err) {
      if (!abortRef.current.signal.aborted) {
        setError(err.message);
      }
    } finally {
      if (!abortRef.current.signal.aborted) {
        setLoading(false);
      }
    }
  }, [latitude, longitude, timezone]);

  useEffect(() => {
    loadWeather();
    const interval = setInterval(loadWeather, 30 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [loadWeather]);

  const retry = () => {
    loadWeather();
  };

  if (loading) {
    return (
      <div className="weather-card loading">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>Loading weather...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="weather-card error">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p>Failed to load weather</p>
        <button onClick={retry} className="retry-btn">
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="weather-card empty">
        <Cloud className="h-8 w-8 text-gray-400" />
        <p>No weather data available</p>
      </div>
    );
  }

  const current = weather.current;
  const hourly = weather.hourly;
  const daily = weather.daily;

  const currentWeather = current ? {
    temperature: current.temperature_2m,
    apparent: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    wind: current.wind_speed_10m,
    code: current.weather_code,
    time: current.time,
  } : null;

  const todayForecast = daily ? {
    date: daily.time[0],
    min: daily.temperature_2m_min[0],
    max: daily.temperature_2m_max[0],
    code: daily.weather_code[0],
    precip: daily.precipitation_probability_max[0],
  } : null;

  const upcomingDays = daily ? daily.time.slice(1, 3).map((date, i) => ({
    date,
    min: daily.temperature_2m_min[i + 1],
    max: daily.temperature_2m_max[i + 1],
    code: daily.weather_code[i + 1],
    precip: daily.precipitation_probability_max[i + 1],
  })) : [];

  const nextHours = hourly ? hourly.time.slice(currentIndex, currentIndex + 6).map((time, i) => ({
    time,
    temp: hourly.temperature_2m[currentIndex + i],
    precip: hourly.precipitation_probability[currentIndex + i],
    code: hourly.weather_code[currentIndex + i],
  })) : [];

  return (
    <div className="weather-section">
      <div className="weather-header">
        <h3>{destination} Weather</h3>
        <span className="weather-updated">Updated just now</span>
      </div>

      {currentWeather && (
        <div className="current-weather">
          <div className="current-main">
            <WeatherIcon code={currentWeather.code} className="h-16 w-16" />
            <div className="current-temp">
              <span className="temp-value">{formatTemperature(currentWeather.temperature)}</span>
              <span className="temp-feels">Feels like {formatTemperature(currentWeather.apparent)}</span>
            </div>
            <div className="current-condition">
              <WeatherIcon code={currentWeather.code} className="h-5 w-5" />
              <span>{getWeatherInfo(currentWeather.code).label}</span>
            </div>
          </div>
          <div className="current-details">
            <div className="detail-item">
              <Droplets className="h-5 w-5" />
              <div>
                <span className="detail-label">Humidity</span>
                <span className="detail-value">{formatHumidity(currentWeather.humidity)}</span>
              </div>
            </div>
            <div className="detail-item">
              <Wind className="h-5 w-5" />
              <div>
                <span className="detail-label">Wind</span>
                <span className="detail-value">{formatWindSpeed(currentWeather.wind)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {todayForecast && (
        <div className="today-forecast">
          <h4>Today</h4>
          <div className="forecast-card today">
            <div className="forecast-main">
              <WeatherIcon code={todayForecast.code} className="h-10 w-10" />
              <div className="forecast-temps">
                <span className="high">{formatTemperature(todayForecast.max)}</span>
                <span className="low">{formatTemperature(todayForecast.min)}</span>
              </div>
              <div className="forecast-condition">
                <span>{getWeatherInfo(todayForecast.code).label}</span>
                <span className="precip">💧 {todayForecast.precip}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {upcomingDays.length > 0 && (
        <div className="upcoming-forecast">
          <h4>Upcoming</h4>
          <div className="forecast-grid">
            {upcomingDays.map((day, idx) => (
              <div key={idx} className="forecast-card">
                <div className="forecast-date">{formatDate(new Date(day.date).getTime() / 1000)}</div>
                <WeatherIcon code={day.code} className="h-8 w-8" />
                <div className="forecast-temps">
                  <span className="high">{formatTemperature(day.max)}</span>
                  <span className="low">{formatTemperature(day.min)}</span>
                </div>
                <div className="forecast-condition">
                  <span>{getWeatherInfo(day.code).label}</span>
                  <span className="precip">💧 {day.precip}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {nextHours.length > 0 && (
        <div className="hourly-forecast">
          <h4>Next 6 Hours</h4>
          <div className="hourly-scroll">
            {nextHours.map((hour, idx) => (
              <div key={idx} className="hourly-item">
                <div className="hourly-time">{formatTime(new Date(hour.time).getTime() / 1000)}</div>
                <WeatherIcon code={hour.code} className="h-6 w-6" />
                <div className="hourly-temp">{formatTemperature(hour.temp)}</div>
                <div className="hourly-precip">💧 {hour.precip}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WeatherComponent;