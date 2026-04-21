import React, { useMemo } from 'react';
import { Music } from 'lucide-react';

/**
 * Генерирует красивую обложку для трека на основе названия
 * Использует хеш строки для создания уникальных цветов
 */
export const TrackCover = ({ 
  cover, 
  artist, 
  title, 
  size = 'md',
  className = '' 
}) => {
  // Размеры обложки
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12', 
    lg: 'w-16 h-16',
    xl: 'w-20 h-20'
  };

  // Генерация уникального градиента на основе названия
  const gradient = useMemo(() => {
    const str = `${artist || ''}${title || ''}`;
    
    // Простой хеш для генерации цветов
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    // Палитра красивых градиентов
    const gradients = [
      'from-purple-500 to-pink-500',
      'from-blue-500 to-purple-500',
      'from-green-500 to-teal-500',
      'from-orange-500 to-red-500',
      'from-pink-500 to-rose-500',
      'from-cyan-500 to-blue-500',
      'from-violet-500 to-purple-500',
      'from-amber-500 to-orange-500',
      'from-emerald-500 to-green-500',
      'from-fuchsia-500 to-pink-500',
      'from-indigo-500 to-violet-500',
      'from-rose-500 to-red-500',
      'from-teal-500 to-cyan-500',
      'from-sky-500 to-blue-500',
      'from-lime-500 to-green-500',
      'from-yellow-500 to-amber-500',
    ];
    
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  }, [artist, title]);

  // Получение первой буквы исполнителя для отображения
  const initial = useMemo(() => {
    if (artist && artist.length > 0) {
      return artist.charAt(0).toUpperCase();
    }
    if (title && title.length > 0) {
      return title.charAt(0).toUpperCase();
    }
    return '♪';
  }, [artist, title]);

  // Если есть обложка - показываем её
  if (cover) {
    return (
      <div className={`${sizeClasses[size]} ${className} rounded-lg overflow-hidden flex-shrink-0`}>
        <img 
          src={cover} 
          alt={`${artist} - ${title}`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            // При ошибке загрузки скрываем изображение
            e.target.style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Генерируем красивую обложку
  return (
    <div 
      className={`${sizeClasses[size]} ${className} rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}
    >
      {/* Декоративные элементы */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1 left-1 w-3 h-3 rounded-full bg-white/20" />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-white/15" />
        <div className="absolute top-1/2 left-1/3 w-1.5 h-1.5 rounded-full bg-white/10" />
      </div>
      
      {/* Иконка или буква */}
      <div className="relative z-10 flex items-center justify-center">
        {size === 'sm' ? (
          <Music className="w-4 h-4 text-white/90" />
        ) : size === 'md' ? (
          <span className="text-lg font-bold text-white/90 drop-shadow-md">
            {initial}
          </span>
        ) : (
          <span className="text-2xl font-bold text-white/90 drop-shadow-md">
            {initial}
          </span>
        )}
      </div>
      
      {/* Блик */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
    </div>
  );
};

export default TrackCover;
