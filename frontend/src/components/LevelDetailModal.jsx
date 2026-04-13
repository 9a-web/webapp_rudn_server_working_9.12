import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { friendsAPI } from '../services/friendsAPI';
import { RefreshCw } from 'lucide-react';

/**
 * Таблица порогов (должна совпадать с бэкендом level_system.py)
 */
const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700,
  1000, 1400, 1900, 2500,
  3200, 4000, 5000, 6200,
  7600, 9200, 11000, 13000,
  15500, 18500, 22000,
];

const TIER_CONFIG = {
  base:    { name: 'Base',    color: '#4D85FF', gradient: 'linear-gradient(135deg, #4D85FF, #6EA0FF)', emoji: '🔵' },
  medium:  { name: 'Medium',  color: '#FFA04D', gradient: 'linear-gradient(135deg, #FFA04D, #FFB976)', emoji: '🟠' },
  rare:    { name: 'Rare',    color: '#B84DFF', gradient: 'linear-gradient(135deg, #B84DFF, #D47FFF)', emoji: '🟣' },
  premium: { name: 'Premium', color: '#FF4EEA', gradient: 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)', emoji: '✨' },
};

const TIER_RANGES = [
  { min: 1,  max: 4,  tier: 'base' },
  { min: 5,  max: 9,  tier: 'medium' },
  { min: 10, max: 19, tier: 'rare' },
  { min: 20, max: 50, tier: 'premium' },
];

/**
 * Модалка детальной информации об уровне.
 * Открывается при нажатии на бейдж LV. в профиле.
 */
export default function LevelDetailModal({ isOpen, onClose, levelData, hapticFeedback, telegramId }) {
  const overlayRef = useRef(null);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [activeSection, setActiveSection] = useState('progress'); // 'progress' | 'rewards' | 'breakdown'
  const [xpRewards, setXpRewards] = useState(null);
  const [xpBreakdown, setXpBreakdown] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setAnimateProgress(false);
      const timer = setTimeout(() => setAnimateProgress(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, levelData?.xp]);

  // Загрузка XP наград при открытии
  useEffect(() => {
    if (isOpen && !xpRewards) {
      friendsAPI.getXPRewardsInfo()
        .then(data => setXpRewards(data?.rewards || []))
        .catch(() => {});
    }
  }, [isOpen, xpRewards]);

  // Загрузка XP breakdown при переключении на таб
  useEffect(() => {
    if (isOpen && activeSection === 'breakdown' && telegramId && !xpBreakdown) {
      friendsAPI.getXPBreakdown(telegramId)
        .then(data => setXpBreakdown(data))
        .catch(() => {});
    }
  }, [isOpen, activeSection, telegramId, xpBreakdown]);

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setActiveSection('progress');
      setRecalcResult(null);
      setXpBreakdown(null);
    }
  }, [isOpen]);

  const handleRecalculate = useCallback(async () => {
    if (!telegramId || recalculating) return;
    setRecalculating(true);
    try {
      const result = await friendsAPI.recalculateXP(telegramId);
      setRecalcResult(result);
      setXpBreakdown(result);
      if (hapticFeedback) hapticFeedback('notification', 'success');
    } catch (err) {
      console.error('Recalculate XP error:', err);
      if (hapticFeedback) hapticFeedback('notification', 'error');
    } finally {
      setRecalculating(false);
    }
  }, [telegramId, recalculating, hapticFeedback]);

  if (!levelData) return null;

  const {
    level = 1,
    tier = 'base',
    xp = 0,
    xp_current_level = 0,
    xp_next_level = 100,
    progress = 0,
  } = recalcResult || levelData;

  const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.base;
  const xpInLevel = xp - xp_current_level;
  const xpNeeded = xp_next_level - xp_current_level;

  const sections = [
    { id: 'progress', label: 'Прогресс' },
    { id: 'rewards', label: 'XP награды' },
    { id: 'breakdown', label: 'Разбивка' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            style={{
              width: '100%',
              maxWidth: '500px',
              maxHeight: '85vh',
              background: 'linear-gradient(180deg, #1A1A2E 0%, #16213E 100%)',
              borderRadius: '24px 24px 0 0',
              padding: '24px 20px 40px',
              position: 'relative',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ручка закрытия */}
            <div
              style={{
                width: '40px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                margin: '0 auto 20px',
              }}
            />

            {/* Заголовок: уровень */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 800,
                  fontSize: '48px',
                  lineHeight: 1.1,
                  background: tier === 'premium'
                    ? 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)'
                    : tierCfg.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginTop: '8px',
                }}
              >
                LV. {level}
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 14px',
                  borderRadius: '16px',
                  background: `${tierCfg.color}18`,
                  border: `1px solid ${tierCfg.color}33`,
                  marginTop: '8px',
                }}
              >
                <span style={{ fontSize: '14px' }}>{tierCfg.emoji}</span>
                <span
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '13px',
                    color: tierCfg.color,
                  }}
                >
                  {tierCfg.name}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 400,
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.5)',
                  marginTop: '8px',
                }}
              >
                {xp.toLocaleString()} XP
              </div>
            </div>

            {/* Табы секций */}
            <div style={{
              display: 'flex',
              gap: '6px',
              marginBottom: '16px',
            }}>
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSection(s.id);
                    if (hapticFeedback) hapticFeedback('impact', 'light');
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: '12px',
                    border: activeSection === s.id
                      ? `1px solid ${tierCfg.color}44`
                      : '1px solid rgba(255,255,255,0.06)',
                    background: activeSection === s.id
                      ? `${tierCfg.color}15`
                      : 'rgba(255,255,255,0.03)',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '12px',
                    color: activeSection === s.id ? tierCfg.color : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Секция: Прогресс */}
            {activeSection === 'progress' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {/* Прогресс-бар */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 500,
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.6)',
                      }}
                    >
                      LV. {level}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 600,
                        fontSize: '13px',
                        color: tierCfg.color,
                      }}
                    >
                      {xpInLevel} / {xpNeeded} XP
                    </span>
                    <span
                      style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 500,
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.6)',
                      }}
                    >
                      LV. {level + 1}
                    </span>
                  </div>

                  {/* Полоска прогресса */}
                  <div
                    style={{
                      height: '12px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: animateProgress ? `${Math.max(progress * 100, 1)}%` : '0%' }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{
                        height: '100%',
                        borderRadius: '6px',
                        background: tier === 'premium'
                          ? 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)'
                          : tierCfg.gradient,
                        boxShadow: `0 0 12px ${tierCfg.color}66`,
                      }}
                    />
                  </div>
                </div>

                {/* Карта тиров */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  {TIER_RANGES.map((range) => {
                    const tc = TIER_CONFIG[range.tier];
                    const isActive = tier === range.tier;
                    return (
                      <div
                        key={range.tier}
                        style={{
                          padding: '10px 6px',
                          borderRadius: '12px',
                          textAlign: 'center',
                          backgroundColor: isActive ? `${tc.color}22` : 'rgba(255,255,255,0.04)',
                          border: isActive ? `1px solid ${tc.color}66` : '1px solid rgba(255,255,255,0.06)',
                          opacity: isActive ? 1 : 0.5,
                          transition: 'all 0.3s ease',
                        }}
                      >
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>{tc.emoji}</div>
                        <div
                          style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontWeight: 600,
                            fontSize: '11px',
                            color: isActive ? tc.color : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {tc.name}
                        </div>
                        <div
                          style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontWeight: 400,
                            fontSize: '10px',
                            color: 'rgba(255,255,255,0.35)',
                            marginTop: '2px',
                          }}
                        >
                          LV. {range.min}–{range.max}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Кнопка пересчёта XP */}
                {telegramId && (
                  <button
                    onClick={handleRecalculate}
                    disabled={recalculating}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: recalculating ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
                      cursor: recalculating ? 'not-allowed' : 'pointer',
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 500,
                      fontSize: '13px',
                      color: recalculating ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <RefreshCw
                      style={{
                        width: '14px',
                        height: '14px',
                        animation: recalculating ? 'spin 1s linear infinite' : 'none',
                      }}
                    />
                    {recalculating ? 'Пересчёт...' : 'Пересчитать XP'}
                  </button>
                )}

                {recalcResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      marginTop: '8px',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.2)',
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: '12px',
                      color: '#10B981',
                      textAlign: 'center',
                    }}
                  >
                    ✓ XP пересчитан: {recalcResult.xp} XP → LV. {recalcResult.level}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Секция: XP награды */}
            {activeSection === 'rewards' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 500,
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: '4px',
                }}>
                  Как заработать XP
                </div>
                {(xpRewards || []).map((reward, idx) => (
                  <motion.div
                    key={reward.action}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{reward.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 500,
                        fontSize: '13px',
                        color: '#F4F3FC',
                      }}>
                        {reward.label}
                      </div>
                      {reward.limit && (
                        <div style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontWeight: 400,
                          fontSize: '10px',
                          color: 'rgba(255,255,255,0.3)',
                          marginTop: '2px',
                        }}>
                          Лимит: {reward.limit}
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 700,
                      fontSize: '14px',
                      color: tierCfg.color,
                      flexShrink: 0,
                    }}>
                      +{reward.xp}
                    </div>
                  </motion.div>
                ))}
                {!xpRewards && (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.3)',
                  }}>
                    Загрузка...
                  </div>
                )}
              </motion.div>
            )}

            {/* Секция: Разбивка XP */}
            {activeSection === 'breakdown' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 500,
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: '4px',
                }}>
                  Откуда ваш XP
                </div>
                {xpBreakdown?.breakdown ? (
                  <>
                    {[
                      { key: 'visits', label: '📅 Ежедневные визиты', color: '#10B981' },
                      { key: 'tasks', label: '✅ Задачи', color: '#3B82F6' },
                      { key: 'group_tasks', label: '👥 Групповые задачи', color: '#8B5CF6' },
                      { key: 'achievements', label: '🏆 Достижения', color: '#F59E0B' },
                      { key: 'streak_bonuses', label: '🔥 Бонусы стрика', color: '#EF4444' },
                      { key: 'referrals', label: '🔗 Рефералы', color: '#06B6D4' },
                      { key: 'messages', label: '💬 Сообщения', color: '#EC4899' },
                    ].filter(item => (xpBreakdown.breakdown[item.key] || 0) > 0)
                      .map((item, idx) => {
                        const value = xpBreakdown.breakdown[item.key] || 0;
                        const totalXP = xpBreakdown.xp || 1;
                        const percent = Math.round((value / totalXP) * 100);
                        return (
                          <motion.div
                            key={item.key}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '14px',
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '6px',
                            }}>
                              <span style={{
                                fontFamily: "'Poppins', sans-serif",
                                fontWeight: 500,
                                fontSize: '13px',
                                color: '#F4F3FC',
                              }}>
                                {item.label}
                              </span>
                              <span style={{
                                fontFamily: "'Poppins', sans-serif",
                                fontWeight: 700,
                                fontSize: '13px',
                                color: item.color,
                              }}>
                                {value} XP ({percent}%)
                              </span>
                            </div>
                            {/* Мини прогресс-бар */}
                            <div style={{
                              height: '4px',
                              borderRadius: '2px',
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              overflow: 'hidden',
                            }}>
                              <motion.div
                                initial={{ width: '0%' }}
                                animate={{ width: `${percent}%` }}
                                transition={{ duration: 0.5, delay: idx * 0.05 }}
                                style={{
                                  height: '100%',
                                  borderRadius: '2px',
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>
                          </motion.div>
                        );
                      })}

                    {/* Итого */}
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: `${tierCfg.color}12`,
                      border: `1px solid ${tierCfg.color}33`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '4px',
                    }}>
                      <span style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 600,
                        fontSize: '14px',
                        color: '#F4F3FC',
                      }}>
                        Итого
                      </span>
                      <span style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 700,
                        fontSize: '16px',
                        color: tierCfg.color,
                      }}>
                        {(xpBreakdown.xp || 0).toLocaleString()} XP
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      border: `2px solid ${tierCfg.color}40`,
                      borderTopColor: tierCfg.color,
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      margin: '0 auto 8px',
                    }} />
                    <span style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.3)',
                    }}>
                      Загрузка...
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
