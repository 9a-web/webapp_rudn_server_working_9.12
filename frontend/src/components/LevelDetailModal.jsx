import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { friendsAPI } from '../services/friendsAPI';
import {
  TIER_CONFIG, TIER_RANGES, TIER_ORDER,
  getTierConfig, getTierIndex, renderStars,
} from '../constants/levelConstants';

/**
 * Модалка детальной информации об уровне v3.0.
 *
 * Новое:
 * - SVG-график истории XP
 * - Кольцо дневного прогресса XP
 * - Система звёзд внутри тиров
 * - Roadmap-вид тиров
 * - Индикатор "Почти там!"
 * - Тир Legend
 */
export default function LevelDetailModal({ isOpen, onClose, levelData, hapticFeedback, telegramId }) {
  const overlayRef = useRef(null);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [activeSection, setActiveSection] = useState('progress');
  const [xpRewards, setXpRewards] = useState(null);
  const [xpBreakdown, setXpBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [xpHistory, setXpHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [dailyXp, setDailyXp] = useState(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

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
      setErrorMsg(null);
      friendsAPI.getXPBreakdown(telegramId)
        .then(data => setXpBreakdown(data))
        .catch(() => setErrorMsg('Не удалось загрузить разбивку XP'))
        .finally(() => setLoadingBreakdown(false));
    }
  }, [isOpen, activeSection, telegramId, xpBreakdown, loadingBreakdown]);

  // Загрузка XP History при переключении на график
  useEffect(() => {
    if (isOpen && activeSection === 'progress' && telegramId && !xpHistory && !loadingHistory) {
      setLoadingHistory(true);
      friendsAPI.getXPHistory(telegramId, 14)
        .then(data => setXpHistory(data?.history || []))
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [isOpen, activeSection, telegramId, xpHistory, loadingHistory]);

  // Загрузка Daily XP при открытии
  useEffect(() => {
    if (isOpen && telegramId && !dailyXp && !loadingDaily) {
      setLoadingDaily(true);
      friendsAPI.getDailyXP(telegramId)
        .then(data => setDailyXp(data))
        .catch(() => {})
        .finally(() => setLoadingDaily(false));
    }
  }, [isOpen, telegramId, dailyXp, loadingDaily]);

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setActiveSection('progress');
      setXpBreakdown(null);
      setXpHistory(null);
      setDailyXp(null);
      setErrorMsg(null);
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
    stars = 1,
    title = '',
  } = levelData;

  const tierCfg = getTierConfig(tier);
  const xpInLevel = Math.max(0, xp - xp_current_level);
  const xpNeeded = Math.max(1, xp_next_level - xp_current_level);
  const almostThere = progress >= 0.85 && progress < 1.0;
  const dailyTotal = dailyXp?.total_xp_today || 0;

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

  const isHighTier = tier === 'premium' || tier === 'legend';

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

            {/* Заголовок: уровень + звёзды */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 800,
                fontSize: '48px',
                lineHeight: 1.1,
                background: isHighTier
                  ? tierCfg.gradient
                  : tierCfg.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginTop: '4px',
                filter: `drop-shadow(0 0 16px ${tierCfg.glow || tierCfg.color + '44'})`,
              }}>
                LV. {level}
              </div>

              {/* Звёзды */}
              <div style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '18px',
                letterSpacing: '3px',
                color: tierCfg.color,
                marginTop: '2px',
                filter: `drop-shadow(0 0 6px ${tierCfg.color}66)`,
              }}>
                {renderStars(stars)}
              </div>

              {/* Бейдж тира + название уровня */}
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
                {title && (
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 400,
                    fontSize: '11px',
                    color: `${tierCfg.color}99`,
                    marginLeft: '4px',
                  }}>
                    · {title}
                  </span>
                )}
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

            {/* Daily XP ring - маленький виджет */}
            {dailyTotal > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '14px',
                padding: '8px 16px',
                borderRadius: '14px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.18)',
              }}>
                <DailyXPRing value={dailyTotal} max={30} color="#10B981" size={32} />
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '13px',
                  color: '#10B981',
                }}>
                  +{dailyTotal} XP сегодня
                </span>
              </div>
            )}

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
                        background: isHighTier
                          ? tierCfg.gradient
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
                    color: almostThere ? tierCfg.color : 'rgba(255,255,255,0.3)',
                    fontWeight: almostThere ? 600 : 400,
                  }}>
                    {almostThere
                      ? `🔥 Почти там! ${Math.round(progress * 100)}% — осталось ${(xpNeeded - xpInLevel).toLocaleString()} XP`
                      : `${Math.round(progress * 100)}% до следующего уровня`
                    }
                  </div>
                </div>

                {/* SVG XP Chart */}
                {xpHistory && xpHistory.length > 1 && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={sectionTitleStyle}>📈 Прогресс XP за 14 дней</div>
                    <XPChart data={xpHistory} color={tierCfg.color} />
                  </div>
                )}

                {/* Roadmap тиров */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={sectionTitleStyle}>🗺️ Дорожная карта</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {TIER_RANGES.map((range, idx) => {
                      const tc = TIER_CONFIG[range.tier];
                      const isActive = tier === range.tier;
                      const isPast = getTierIndex(tier) > getTierIndex(range.tier);
                      const isFuture = getTierIndex(tier) < getTierIndex(range.tier);
                      const isNext = getTierIndex(range.tier) === getTierIndex(tier) + 1;
                      return (
                        <div
                          key={range.tier}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 14px',
                            borderRadius: '14px',
                            backgroundColor: isActive ? `${tc.color}14` : 'rgba(255,255,255,0.02)',
                            border: isActive
                              ? `1.5px solid ${tc.color}44`
                              : isNext
                                ? `1px dashed ${tc.color}30`
                                : '1px solid rgba(255,255,255,0.04)',
                            opacity: isFuture && !isNext ? 0.4 : 1,
                            transition: 'all 0.3s ease',
                          }}
                        >
                          {/* Иконка статуса */}
                          <div style={{
                            width: '28px', height: '28px',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px',
                            background: isPast
                              ? `${tc.color}25`
                              : isActive
                                ? `${tc.color}30`
                                : 'rgba(255,255,255,0.05)',
                            border: isActive ? `2px solid ${tc.color}` : 'none',
                            flexShrink: 0,
                          }}>
                            {isPast ? '✓' : tc.emoji}
                          </div>

                          {/* Инфо */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: "'Poppins', sans-serif",
                              fontWeight: isActive ? 700 : 500,
                              fontSize: '13px',
                              color: isActive ? tc.color : isPast ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)',
                            }}>
                              {tc.name}
                              {isActive && <span style={{ fontSize: '11px', marginLeft: '6px', opacity: 0.7 }}>← Вы здесь</span>}
                            </div>
                            <div style={{
                              fontFamily: "'Poppins', sans-serif",
                              fontWeight: 400, fontSize: '11px',
                              color: 'rgba(255,255,255,0.25)',
                            }}>
                              LV. {range.min}–{range.max}
                            </div>
                          </div>

                          {/* Звёзды для текущего */}
                          {isActive && (
                            <div style={{
                              fontFamily: "'Poppins', sans-serif",
                              fontSize: '14px',
                              color: tc.color,
                              letterSpacing: '1px',
                              flexShrink: 0,
                            }}>
                              {renderStars(stars)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
                {errorMsg ? (
                  <div style={{
                    textAlign: 'center', padding: '24px',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '13px', color: '#EF4444',
                  }}>
                    {errorMsg}
                  </div>
                ) : xpBreakdown?.breakdown ? (
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


/* ── SVG XP Chart ── */
function XPChart({ data, color }) {
  if (!data || data.length < 2) return null;

  const W = 320;
  const H = 100;
  const PAD = { top: 10, right: 10, bottom: 22, left: 10 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxXP = Math.max(...data.map(d => d.xp_earned), 1);

  const points = data.map((d, i) => {
    const x = PAD.left + (i / (data.length - 1)) * chartW;
    const y = PAD.top + chartH - (d.xp_earned / maxXP) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD.top + chartH} L ${points[0].x} ${PAD.top + chartH} Z`;

  return (
    <div style={{
      padding: '12px',
      borderRadius: '14px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={PAD.top + chartH * (1 - r)}
            x2={PAD.left + chartW}
            y2={PAD.top + chartH * (1 - r)}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#chartGrad)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.xp_earned > 0 ? 3 : 2}
            fill={p.xp_earned > 0 ? color : 'rgba(255,255,255,0.15)'}
            stroke="none"
          />
        ))}

        {/* Date labels */}
        {points.filter((_, i) => i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2)).map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={H - 4}
            textAnchor="middle"
            fill="rgba(255,255,255,0.25)"
            fontSize="9"
            fontFamily="Poppins, sans-serif"
          >
            {p.date?.slice(5)}
          </text>
        ))}

        {/* Max value label */}
        <text
          x={PAD.left + chartW}
          y={PAD.top - 2}
          textAnchor="end"
          fill="rgba(255,255,255,0.3)"
          fontSize="9"
          fontFamily="Poppins, sans-serif"
        >
          макс: {maxXP} XP
        </text>
      </svg>
    </div>
  );
}


/* ── Daily XP Ring ── */
function DailyXPRing({ value, max, color, size = 32 }) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / Math.max(max, 1), 1);
  const dashOffset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
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
  marginBottom: '8px',
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
