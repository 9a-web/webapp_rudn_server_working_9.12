import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCheck, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getUserJournals, createJournal } from '../services/journalAPI';
import { JournalCard, CreateJournalModal, JournalDetailModal } from './journal';

export const JournalSection = ({ telegramId, hapticFeedback, userSettings }) => {
  const { t } = useTranslation();
  const [journals, setJournals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState(null);

  const loadJournals = useCallback(async () => {
    if (!telegramId) return;
    
    setIsLoading(true);
    try {
      const data = await getUserJournals(telegramId);
      setJournals(data);
    } catch (error) {
      console.error('Error loading journals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [telegramId]);

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  const handleCreateJournal = async (journalData) => {
    try {
      await createJournal({
        ...journalData,
        telegram_id: telegramId
      });
      loadJournals();
    } catch (error) {
      console.error('Error creating journal:', error);
      throw error;
    }
  };

  const handleJournalClick = (journal) => {
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('light');
    }
    setSelectedJournal(journal);
  };

  const ownedJournals = journals.filter(j => j.is_owner);
  const memberJournals = journals.filter(j => !j.is_owner);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-[calc(100vh-140px)] bg-white rounded-t-[40px] mt-6 p-6"
    >
      {/* Header секции */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
            <FileCheck className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1C1C1E]">Журнал</h2>
            <p className="text-sm text-[#999999]">Журнал посещаемости группы</p>
          </div>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={loadJournals}
            className="p-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Создать</span>
          </motion.button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : journals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400/10 to-pink-400/10 flex items-center justify-center mb-4">
            <FileCheck className="w-12 h-12 text-purple-500" strokeWidth={2} />
          </div>
          <h3 className="text-lg font-semibold text-[#1C1C1E] mb-2">
            Нет журналов
          </h3>
          <p className="text-sm text-[#999999] text-center max-w-xs mb-4">
            Создайте свой первый журнал посещаемости или присоединитесь к существующему по приглашению
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium"
          >
            <Plus className="w-5 h-5" />
            Создать журнал
          </motion.button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Owned Journals */}
          {ownedJournals.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                Мои журналы ({ownedJournals.length})
              </h3>
              <div className="space-y-3">
                {ownedJournals.map((journal, index) => (
                  <motion.div
                    key={journal.journal_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <JournalCard
                      journal={journal}
                      onClick={handleJournalClick}
                      hapticFeedback={hapticFeedback}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Member Journals */}
          {memberJournals.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Участник ({memberJournals.length})
              </h3>
              <div className="space-y-3">
                {memberJournals.map((journal, index) => (
                  <motion.div
                    key={journal.journal_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (ownedJournals.length + index) * 0.05 }}
                  >
                    <JournalCard
                      journal={journal}
                      onClick={handleJournalClick}
                      hapticFeedback={hapticFeedback}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <CreateJournalModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateJournal}
        hapticFeedback={hapticFeedback}
        defaultGroupName={userSettings?.group_name || ''}
      />

      {/* Detail Modal */}
      {selectedJournal && (
        <JournalDetailModal
          isOpen={!!selectedJournal}
          onClose={() => {
            setSelectedJournal(null);
            loadJournals();
          }}
          journalId={selectedJournal.journal_id}
          telegramId={telegramId}
          hapticFeedback={hapticFeedback}
          onJournalUpdated={loadJournals}
        />
      )}
    </motion.div>
  );
};
