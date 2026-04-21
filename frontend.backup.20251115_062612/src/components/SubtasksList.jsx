/**
 * Компонент для управления подзадачами
 */

import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Check, X, Plus, GripVertical, Trash2 } from 'lucide-react';

const SubtasksList = ({ 
  subtasks = [], 
  onAdd, 
  onUpdate, 
  onDelete,
  onReorder,
  isReadOnly = false
}) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddSubtask = async () => {
    const trimmedTitle = newSubtaskTitle.trim();
    
    if (!trimmedTitle) return;

    try {
      setIsAdding(true);
      await onAdd(trimmedTitle);
      setNewSubtaskTitle('');
    } catch (error) {
      console.error('Error adding subtask:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleSubtask = async (subtask) => {
    try {
      await onUpdate(subtask.subtask_id, {
        completed: !subtask.completed
      });
    } catch (error) {
      console.error('Error toggling subtask:', error);
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    try {
      await onDelete(subtaskId);
    } catch (error) {
      console.error('Error deleting subtask:', error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubtask();
    }
  };

  return (
    <div className="space-y-3">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Подзадачи ({subtasks.length})
        </h4>
        {subtasks.length > 0 && (
          <span className="text-xs text-gray-500">
            {subtasks.filter(s => s.completed).length} / {subtasks.length} выполнено
          </span>
        )}
      </div>

      {/* Список подзадач */}
      {subtasks.length > 0 && (
        <Reorder.Group
          axis="y"
          values={subtasks}
          onReorder={onReorder}
          className="space-y-2"
        >
          <AnimatePresence>
            {subtasks.map((subtask) => (
              <Reorder.Item
                key={subtask.subtask_id}
                value={subtask}
                className="flex items-center gap-2 p-2.5 
                         bg-gray-800/50 border border-gray-700 rounded-lg
                         hover:border-gray-600 transition-colors group"
              >
                {/* Drag Handle */}
                {!isReadOnly && (
                  <div className="cursor-grab active:cursor-grabbing touch-none">
                    <GripVertical className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
                  </div>
                )}

                {/* Checkbox */}
                <button
                  onClick={() => handleToggleSubtask(subtask)}
                  disabled={isReadOnly}
                  className={`
                    flex-shrink-0 w-5 h-5 rounded-md border-2 
                    flex items-center justify-center transition-all
                    touch-manipulation active:scale-95
                    ${subtask.completed
                      ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-500'
                      : 'bg-transparent border-gray-600 hover:border-gray-500'
                    }
                    ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}
                  `}
                >
                  {subtask.completed && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </button>

                {/* Название */}
                <span className={`
                  flex-1 text-sm
                  ${subtask.completed 
                    ? 'line-through text-gray-500' 
                    : 'text-gray-300'
                  }
                `}>
                  {subtask.title}
                </span>

                {/* Кнопка удаления */}
                {!isReadOnly && (
                  <button
                    onClick={() => handleDeleteSubtask(subtask.subtask_id)}
                    className="flex-shrink-0 p-1 rounded-md
                             text-gray-500 hover:text-red-400 hover:bg-red-500/10
                             transition-colors touch-manipulation active:scale-95
                             opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      {/* Поле добавления новой подзадачи */}
      {!isReadOnly && (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2
                       bg-gray-800 border border-gray-700 rounded-lg
                       focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/20
                       transition-all">
            <Plus className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Добавить подзадачу..."
              maxLength={100}
              disabled={isAdding}
              className="flex-1 bg-transparent text-white text-sm
                       placeholder-gray-500 focus:outline-none
                       disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleAddSubtask}
            disabled={!newSubtaskTitle.trim() || isAdding}
            className="p-2 rounded-lg
                     bg-gradient-to-r from-green-500 to-emerald-600
                     text-white disabled:opacity-30 disabled:cursor-not-allowed
                     hover:from-green-600 hover:to-emerald-700
                     active:scale-95 transition-all touch-manipulation"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Пустое состояние */}
      {subtasks.length === 0 && !isReadOnly && (
        <div className="py-4 text-center">
          <p className="text-sm text-gray-500">
            Нет подзадач. Добавьте первую!
          </p>
        </div>
      )}
    </div>
  );
};

export default SubtasksList;
