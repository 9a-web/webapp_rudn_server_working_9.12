import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, AlertCircle, Unlink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const EditStudentModal = ({ 
  isOpen, 
  onClose, 
  student, 
  onUpdate, 
  onDelete, 
  onUnlink,
  hapticFeedback,
  botUsername = "bot"
}) => {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    if (student) {
      setFullName(student.full_name);
    }
  }, [student]);

  if (!isOpen || !student) return null;

  // Link format: https://t.me/bot?start=bind_STUDENT_ID
  const personalLink = `https://t.me/${botUsername}?start=bind_${student.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(personalLink);
    setCopied(true);
    if (hapticFeedback?.notificationOccurred) {
      hapticFeedback.notificationOccurred('success');
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onUpdate(student.id, { full_name: fullName });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(t('journal.deleteStudentConfirm', 'Delete this student?'))) {
      onDelete(student.id);
      onClose();
    }
  };

  const handleUnlink = () => {
    if (window.confirm(t('journal.unlinkStudentConfirm', 'Unlink Telegram account?'))) {
      onUnlink(student.id);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#1C1C1E] rounded-2xl p-6 w-full max-w-sm shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">{t('journal.editStudent', 'Редактирование студента')}</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                {t('journal.studentName', 'ФИО студента')}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder={t('journal.studentNamePlaceholder', 'Иванов Иван')}
              />
            </div>

            {/* Personal Link Section */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-100">
                    {t('journal.personalLinkTitle', 'Персональная ссылка')}
                  </p>
                  <p className="text-xs text-blue-300/80 mt-1">
                    {t('journal.personalLinkDesc', 'Отправьте эту ссылку студенту для автоматической привязки')}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <div className="flex-1 bg-black/20 rounded-lg px-3 py-2 text-xs text-blue-200 font-mono truncate">
                  {personalLink}
                </div>
                <button
                  onClick={handleCopy}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    copied ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Linked Status */}
            {student.is_linked ? (
              <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-green-100">
                    {t('journal.linkedTo', 'Привязан к')}: {student.first_name || student.username || 'User'}
                  </span>
                </div>
                <button
                  onClick={handleUnlink}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                  title={t('journal.unlink', 'Отвязать')}
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-gray-500" />
                <span className="text-sm text-gray-400">{t('journal.notLinked', 'Не привязан')}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('common.delete', 'Удалить')}
              </button>
              <button
                onClick={handleSave}
                disabled={!fullName.trim()}
                className="flex-[2] py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.save', 'Сохранить')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
