
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, ChevronDown } from 'lucide-react';
import api from '../services/api';

const NotificationHistory = ({ telegramId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [telegramId]);

  const fetchHistory = async () => {
    try {
      const response = await api.get(`/user-settings/${telegramId}/history?limit=10`);
      setHistory(response.data.history);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-400 text-sm">Загрузка истории...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-6 bg-white/5 rounded-xl border border-white/10">
        <Bell className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
        <p className="text-sm text-gray-400">История уведомлений пуста</p>
      </div>
    );
  }

  const displayedHistory = expanded ? history : history.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Последние уведомления</h3>
        {history.length > 3 && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-400 flex items-center gap-1 hover:text-blue-300 transition-colors"
          >
            {expanded ? 'Свернуть' : 'Показать все'}
            <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
              <ChevronDown className="w-3 h-3" />
            </motion.div>
          </button>
        )}
      </div>

      <AnimatePresence>
        <div className="space-y-2">
          {displayedHistory.map((item, index) => (
            <motion.div
              key={item.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-xl p-3 relative overflow-hidden group"
            >
              {/* Декоративная полоска слева */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/50 rounded-l-xl" />

              <div className="flex justify-between items-start mb-1 pl-2">
                <span className="font-medium text-white text-sm line-clamp-1">{item.title}</span>
                <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2 flex flex-col items-end">
                  <span>{formatDate(item.sent_at)}</span>
                  <span>{formatTime(item.sent_at)}</span>
                </span>
              </div>
              
              <div className="text-xs text-gray-400 pl-2 flex items-center gap-2">
                 {item.message}
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
};

export default NotificationHistory;
