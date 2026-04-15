import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { friendsAPI } from '../services/friendsAPI';
import { TIER_CONFIG, TIER_RANGES, getTierConfig } from '../constants/levelConstants';

/**
 * Модалка детальной информации об уровне.
 * Открывается при нажатии на бейдж LV. в профиле.
 *
 * v2.0:
 * - Убран авто-recalculate (не мутирует данные)
 * - Загружает read-only breakdown через GET /xp-breakdown
 * - Отображает bonus, schedule_views, task_on_time_bonus
 * - Единый TIER_CONFIG из levelConstants
 */
export default function LevelDetailModal({ isOpen, onClose, levelData, hapticFeedback, telegramId }) {
  const overlayRef = useRef(null);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [activeSection, setActiveSection] = useState('progress');
  const [xpRewards, setXpRewards] = useState(null);
  const [xpBreakdown, setXpBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  // Анимация прогресс-бара при открытии
  useEffect(() => {
    if (isOpen) {
      setAnimateProgress(false);
      const timer = setTimeout(() => setAnimateProgress(true), 250);
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

  // Загрузка XP breakdown при переключении на вкладку
  useEffect(() => {
    if (isOpen && activeSection === 'breakdown' && telegramId && !xpBreakdown && !loadingBreakdown) {
      setLoadingBreakdown(true);
      friendsAPI.getXPBreakdown(telegramId)
        .then(data => setXpBreakdown(data))
        .catch(() => {})
        .finally(() => setLoadingBreakdown(false));
    }
  }, [isOpen, activeSection, telegramId, xpBreakdown, loadingBreakdown]);

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setActiveSection('progress');
      setXpBreakdown(null);
    }
  }, [isOpen]);

  if (!levelData) return null;

  const {
    level = 1,
    tier = 'base',
    xp = 0,
    xp_current_level = 0,
    xp_next_level = 100,
    progress = 0,
  } = levelData;

  const tierCfg = getTierConfig(tier);
  const xpInLevel = Math.max(0, xp - xp_current_level);
  const xpNeeded = Math.max(1, xp_next_level - xp_current_level);

  const sections = [
    { id: 'progress', label: 'Прогресс', icon: '📊' },
    { id: 'rewards',  label: 'Награды',  icon: '🎁' },
    { id: 'breakdown', label: 'Разбивка', icon: '📋' },
  ];

  // Все категории для breakdown с правильными ключами
  const breakdownCategories = [
    { key: 'visits',             label: 'Ежедневные визиты',     color: '#10B981', icon: '📅' },
    { key: 'tasks',              label: 'Задачи',                color: '#3B82F6', icon: '✅' },
    { key: 'task_on_time_bonus', label: 'Бонус за вовремя',      color: '#60A5FA', icon: '⏰' },
    { key: 'group_tasks',        label: 'Групповые задачи',      color: '#8B5CF6', icon: '👥' },
    { key: 'achievements',       label: 'Достижения',            color: '#F59E0B', icon: '🏆' },
    { key: 'streak_bonuses',     label: 'Бонусы стрика',         color: '#EF4444', icon: '🔥' },
    { key: 'referrals',          label: 'Рефералы',              color: '#06B6D4', icon: '🔗' },
    { key: 'messages',           label: 'Сообщения',             color: '#EC4899', icon: '💬' },
    { key: 'schedule_views',     label: 'Просмотры расписания',  color: '#14B8A6', icon: '📋' },
    { key: 'bonus',              label: 'Бонусный XP',           color: '#A78BFA', icon: '🎁' },
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
            WebkitBackdropFilter: 'blur(4px)',
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
            {/* Ручка */}
            <div style={{
              width: '40px', height: '4px', borderRadius: '2px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              margin: '0 auto 20px',
            }} />

            {/* Заголовок: уровень */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{
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
                marginTop: '4px',
                filter: `drop-shadow(0 0 16px ${tierCfg.glow || tierCfg.color + '44'})`,
              }}>
                LV. {level}
              </div>

              {/* Бейдж тира */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 14px',
                borderRadius: '16px',
                background: `${tierCfg.color}14`,
                border: `1px solid ${tierCfg.color}30`,
                marginTop: '8px',
              }}>
                <span style={{ fontSize: '14px' }}>{tierCfg.emoji}</span>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '13px',
                  color: tierCfg.color,
                }}>
                  {tierCfg.name}
                </span>
              </div>

              <div style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: '14px',
                color: 'rgba(255,255,255,0.45)',
                marginTop: '8px',
              }}>
                {xp.toLocaleString()} XP
              </div>
            </div>

            {/* Табы */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
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
                      ? `1px solid ${tierCfg.color}40`
                      : '1px solid rgba(255,255,255,0.06)',
                    background: activeSection === s.id
                      ? `${tierCfg.color}12`
                      : 'rgba(255,255,255,0.03)',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '12px',
                    color: activeSection === s.id ? tierCfg.color : 'rgba(255,255,255,0.35)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '11px' }}>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>

            {/* ═══ Секция: Прогресс ═══ */}
            {activeSection === 'progress' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Прогресс-бар */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={labelStyle}>LV. {level}</span>
                    <span style={{ ...labelStyle, color: tierCfg.color, fontWeight: 600 }}>
                      {xpInLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP
                    </span>
                    <span style={labelStyle}>LV. {level + 1}</span>
                  </div>

                  <div style={{
                    height: '12px', borderRadius: '6px',
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    overflow: 'hidden', position: 'relative',
                  }}>
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: animateProgress ? `${Math.max(progress * 100, 0.5)}%` : '0%' }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{
                        height: '100%', borderRadius: '6px',
                        background: tier === 'premium'
                          ? 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)'
                          : tierCfg.gradient,
                        boxShadow: `0 0 14px ${tierCfg.color}55`,
                      }}
                    />
                  </div>

                  <div style={{
                    textAlign: 'center',
                    marginTop: '6px',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.3)',
                  }}>
                    {Math.round(progress * 100)}% до следующего уровня
                  </div>
                </div>

                {/* Карта тиров */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                  marginBottom: '8px',
                }}>
                  {TIER_RANGES.map((range) => {
                    const tc = TIER_CONFIG[range.tier];
                    const isActive = tier === range.tier;
                    const isPast = TIER_RANGES.findIndex(r => r.tier === tier) > TIER_RANGES.findIndex(r => r.tier === range.tier);
                    return (
                      <div
                        key={range.tier}
                        style={{
                          padding: '10px 6px',
                          borderRadius: '12px',
                          textAlign: 'center',
                          backgroundColor: isActive ? `${tc.color}18` : 'rgba(255,255,255,0.03)',
                          border: isActive
                            ? `1.5px solid ${tc.color}55`
                            : isPast
                              ? `1px solid ${tc.color}22`
                              : '1px solid rgba(255,255,255,0.05)',
                          opacity: isActive ? 1 : isPast ? 0.65 : 0.4,
                          transition: 'all 0.3s ease',
                        }}
                      >
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>{tc.emoji}</div>
                        <div style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontWeight: 600, fontSize: '11px',
                          color: isActive ? tc.color : 'rgba(255,255,255,0.5)',
                        }}>
                          {tc.name}
                        </div>
                        <div style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontWeight: 400, fontSize: '10px',
                          color: 'rgba(255,255,255,0.3)', marginTop: '2px',
                        }}>
                          LV. {range.min}–{range.max}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ═══ Секция: XP награды ═══ */}
            {activeSection === 'rewards' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <div style={sectionTitleStyle}>Как заработать XP</div>
                {(xpRewards || []).map((reward, idx) => (
                  <motion.div
                    key={reward.action}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 14px', borderRadius: '14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{reward.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Poppins', sans-serif", fontWeight: 500,
                        fontSize: '13px', color: '#F4F3FC',
                      }}>
                        {reward.label}
                      </div>
                      {reward.limit && (
                        <div style={{
                          fontFamily: "'Poppins', sans-serif", fontWeight: 400,
                          fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '2px',
                        }}>
                          Лимит: {reward.limit}
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 700, fontSize: '14px',
                      color: tierCfg.color, flexShrink: 0,
                    }}>
                      +{reward.xp}
                    </div>
                  </motion.div>
                ))}
                {!xpRewards && <LoadingSpinner color={tierCfg.color} />}
              </motion.div>
            )}

            {/* ═══ Секция: Разбивка XP ═══ */}
            {activeSection === 'breakdown' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <div style={sectionTitleStyle}>Откуда ваш XP</div>
                {xpBreakdown?.breakdown ? (
                  <>
                    {breakdownCategories
                      .filter(item => (xpBreakdown.breakdown[item.key] || 0) > 0)
                      .map((item, idx) => {
                        const value = xpBreakdown.breakdown[item.key] || 0;
                        const totalXP = xpBreakdown.xp || 1;
                        const percent = Math.round((value / totalXP) * 100);
                        return (
                          <motion.div
                            key={item.key}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            style={{
                              padding: '12px 14px', borderRadius: '14px',
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            <div style={{
                              display: 'flex', justifyContent: 'space-between',
                              alignItems: 'center', marginBottom: '6px',
                            }}>
                              <span style={{
                                fontFamily: "'Poppins', sans-serif", fontWeight: 500,
                                fontSize: '13px', color: '#F4F3FC',
                              }}>
                                {item.icon} {item.label}
                              </span>
                              <span style={{
                                fontFamily: "'Poppins', sans-serif", fontWeight: 700,
                                fontSize: '13px', color: item.color,
                              }}>
                                {value.toLocaleString()} XP
                                <span style={{ fontWeight: 400, fontSize: '11px', opacity: 0.6, marginLeft: '4px' }}>
                                  {percent}%
                                </span>
                              </span>
                            </div>
                            {/* Мини прогресс-бар */}
                            <div style={{
                              height: '4px', borderRadius: '2px',
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              overflow: 'hidden',
                            }}>
                              <motion.div
                                initial={{ width: '0%' }}
                                animate={{ width: `${percent}%` }}
                                transition={{ duration: 0.5, delay: idx * 0.04 }}
                                style={{
                                  height: '100%', borderRadius: '2px',
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>
                          </motion.div>
                        );
                      })}

                    {/* Итого */}
                    <div style={{
                      padding: '14px', borderRadius: '14px',
                      background: `${tierCfg.color}10`,
                      border: `1px solid ${tierCfg.color}28`,
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginTop: '6px',
                    }}>
                      <span style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 600, fontSize: '14px', color: '#F4F3FC',
                      }}>
                        Итого
                      </span>
                      <span style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 700, fontSize: '16px', color: tierCfg.color,
                      }}>
                        {(xpBreakdown.xp || 0).toLocaleString()} XP
                      </span>
                    </div>
                  </>
                ) : (
                  <LoadingSpinner color={tierCfg.color} />
                )}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Helpers ── */

const labelStyle = {
  fontFamily: "'Poppins', sans-serif",
  fontWeight: 500,
  fontSize: '13px',
  color: 'rgba(255,255,255,0.5)',
};

const sectionTitleStyle = {
  fontFamily: "'Poppins', sans-serif",
  fontWeight: 500,
  fontSize: '12px',
  color: 'rgba(255,255,255,0.3)',
  marginBottom: '4px',
};

function LoadingSpinner({ color }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px' }}>
      <div style={{
        width: '24px', height: '24px',
        border: `2px solid ${color}30`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        margin: '0 auto 8px',
      }} />
      <span style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: '13px',
        color: 'rgba(255,255,255,0.25)',
      }}>
        Загрузка...
      </span>
    </div>
  );
}
