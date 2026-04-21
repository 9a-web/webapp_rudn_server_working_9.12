import React, { useState, useEffect } from 'react';
import { Cloud, Droplets, Wind, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { weatherAPI } from '../services/api';

export const WeatherWidget = ({ hapticFeedback }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadWeather = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await weatherAPI.getWeather();
      setWeather(data);
      setLastUpdate(new Date());
      hapticFeedback && hapticFeedback('notification', 'success');
    } catch (err) {
      console.error('Error loading weather:', err);
      setError(err.message);
      hapticFeedback && hapticFeedback('notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeather();
    // Обновляем погоду каждые 30 минут
    const interval = setInterval(loadWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    hapticFeedback && hapticFeedback('impact', 'light');
    loadWeather();
  };

  if (loading && !weather) {
    return (
      <motion.div
        className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-3xl p-4 border border-blue-500/20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-center h-24">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      </motion.div>
    );
  }

  if (error && !weather) {
    return (
      <motion.div
        className="bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-3xl p-4 border border-red-500/20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col items-center justify-center h-24 gap-2">
          <Cloud className="w-6 h-6 text-red-400" />
          <p className="text-xs text-red-400 text-center">Не удалось загрузить погоду</p>
          <button
            onClick={handleRefresh}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Повторить
          </button>
        </div>
      </motion.div>
    );
  }

  if (!weather) return null;

  return (
    <motion.div
      className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-3xl p-4 border border-blue-500/20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{weather.icon}</span>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{weather.temperature}°</span>
              <span className="text-sm text-gray-400">Москва</span>
            </div>
            <p className="text-xs text-gray-400">
              Ощущается как {weather.feels_like}°
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-2 hover:bg-white/5 rounded-full transition-colors disabled:opacity-50"
          title="Обновить погоду"
        >
          <RefreshCw className={`w-4 h-4 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="text-sm text-gray-300 mb-3">
        {weather.description}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Влажность */}
        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-2">
          <Droplets className="w-4 h-4 text-blue-400" />
          <div>
            <p className="text-xs text-gray-400">Влажность</p>
            <p className="text-sm font-semibold text-white">{weather.humidity}%</p>
          </div>
        </div>

        {/* Ветер */}
        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-2">
          <Wind className="w-4 h-4 text-cyan-400" />
          <div>
            <p className="text-xs text-gray-400">Ветер</p>
            <p className="text-sm font-semibold text-white">{weather.wind_speed} км/ч</p>
          </div>
        </div>
      </div>

      {lastUpdate && (
        <p className="text-xs text-gray-500 text-center mt-3">
          Обновлено: {lastUpdate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </motion.div>
  );
};
