/**
 * Компонент для ввода и управления тегами
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Tag } from 'lucide-react';

const TagsInput = ({ tags = [], onChange, maxTags = 5, placeholder = 'Добавить тег...' }) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleAddTag = () => {
    const trimmedValue = inputValue.trim().toLowerCase();
    
    if (!trimmedValue) return;
    if (tags.length >= maxTags) return;
    if (tags.includes(trimmedValue)) {
      setInputValue('');
      return;
    }

    onChange([...tags, trimmedValue]);
    setInputValue('');
  };

  const handleRemoveTag = (tagToRemove) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      handleRemoveTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      {/* Список тегов */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {tags.map((tag, index) => (
              <motion.div
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="flex items-center gap-1 px-2.5 py-1 
                         bg-gradient-to-r from-purple-500/20 to-pink-500/20 
                         border border-purple-400/30 rounded-lg
                         text-xs font-medium text-purple-200"
              >
                <Tag className="w-3 h-3" />
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-purple-100 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Поле ввода */}
      <div className={`
        flex items-center gap-2 px-3 py-2 
        bg-gray-800 border rounded-xl
        transition-all
        ${isFocused 
          ? 'border-purple-500 ring-2 ring-purple-500/20' 
          : 'border-gray-700'
        }
      `}>
        <Tag className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={tags.length < maxTags ? placeholder : `Максимум ${maxTags} тегов`}
          disabled={tags.length >= maxTags}
          maxLength={20}
          className="flex-1 bg-transparent text-white text-sm
                   placeholder-gray-500 focus:outline-none
                   disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={handleAddTag}
          disabled={!inputValue.trim() || tags.length >= maxTags}
          className="p-1 rounded-lg
                   bg-gradient-to-r from-purple-500 to-pink-500
                   text-white disabled:opacity-30 disabled:cursor-not-allowed
                   hover:from-purple-600 hover:to-pink-600
                   active:scale-95 transition-all touch-manipulation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Подсказка */}
      <p className="text-xs text-gray-500">
        {tags.length}/{maxTags} тегов • Нажмите Enter или + для добавления
      </p>
    </div>
  );
};

export default TagsInput;
