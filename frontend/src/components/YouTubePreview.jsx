import React from 'react';
import { Play, Clock, ExternalLink } from 'lucide-react';

/**
 * Компонент для отображения превью YouTube видео в задаче
 * Режимы: 
 * - badge (новый) - маленький ярлык с названием
 * - compact - компактная карточка 
 * - full - полная карточка с превью
 */
export const YouTubePreview = ({ 
  title, 
  duration, 
  thumbnail, 
  url,
  compact = false, // Компактный режим для карточки задачи
  badge = false,   // Режим ярлыка (badge) - самый компактный
  onClick 
}) => {
  if (!title || !url) return null;
  
  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      // Открываем видео в новой вкладке
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };
  
  // Обрезаем название для ярлыка
  const truncateTitle = (text, maxLength = 35) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  };
  
  // Режим ярлыка (badge) - самый компактный
  if (badge) {
    return (
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg text-[10px] font-medium transition-all shadow-sm hover:shadow group max-w-full"
        title={title}
      >
        {/* YouTube иконка */}
        <Play className="w-3 h-3 flex-shrink-0 fill-white" />
        
        {/* Название видео */}
        <span className="truncate">
          {truncateTitle(title)}
        </span>
        
        {/* Длительность если есть */}
        {duration && (
          <span className="flex-shrink-0 text-red-200 text-[9px]">
            {duration}
          </span>
        )}
        
        {/* Иконка внешней ссылки */}
        <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }
  
  // Компактный режим для списка задач
  if (compact) {
    return (
      <div 
        className="mt-2 flex items-center gap-2 p-2 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border border-red-100 cursor-pointer hover:border-red-200 transition-all group"
        onClick={handleClick}
      >
        {/* YouTube иконка */}
        <div className="flex-shrink-0 w-6 h-6 bg-red-500 rounded flex items-center justify-center">
          <Play className="w-3 h-3 text-white fill-white" />
        </div>
        
        {/* Информация о видео */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-gray-800 truncate group-hover:text-red-600 transition-colors">
            {title}
          </p>
          {duration && (
            <div className="flex items-center gap-1 text-[9px] text-gray-500">
              <Clock className="w-2.5 h-2.5" />
              <span>{duration}</span>
            </div>
          )}
        </div>
        
        {/* Иконка внешней ссылки */}
        <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-red-500 transition-colors flex-shrink-0" />
      </div>
    );
  }
  
  // Полный режим для деталей задачи
  return (
    <div 
      className="mt-3 rounded-xl overflow-hidden border border-red-100 bg-gradient-to-br from-red-50 to-pink-50 cursor-pointer hover:shadow-md transition-all group"
      onClick={handleClick}
    >
      {/* Превью изображение */}
      {thumbnail && (
        <div className="relative aspect-video bg-gray-100">
          <img 
            src={thumbnail} 
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Оверлей с кнопкой воспроизведения */}
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
              <Play className="w-6 h-6 text-white fill-white ml-0.5" />
            </div>
          </div>
          {/* Длительность */}
          {duration && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded">
              {duration}
            </div>
          )}
        </div>
      )}
      
      {/* Информация о видео */}
      <div className="p-3">
        <div className="flex items-start gap-2">
          {/* YouTube иконка */}
          <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-red-600 transition-colors">
              {title}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              {duration && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{duration}</span>
                </div>
              )}
              <span className="text-xs text-red-500 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Открыть на YouTube
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YouTubePreview;
