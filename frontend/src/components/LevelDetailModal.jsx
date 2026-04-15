import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Sparkles, ListChecks,
  CalendarCheck, CheckCircle2, Clock, Users,
  Trophy, Flame, Link2, MessageCircle, CalendarDays,
  Gift, Shield, Swords, Crown, Gem, Sun,
  ChevronRight, Lock, CircleCheckBig, TrendingUp,
  Zap, Target, Star,
} from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';
import {
  TIER_CONFIG, TIER_RANGES,
  getTierConfig, getTierIndex, renderStars,
} from '../constants/levelConstants';

/* ─── Tier Icon Map (lucide) ─── */
const TIER_ICONS = {
  base:    Shield,
  medium:  Swords,
  rare:    Crown,
  premium: Gem,
  legend:  Sun,
};

/* ─── XP Action Icon Map ─── */
const ACTION_ICONS = {
  daily_visit:        CalendarCheck,
  task_complete:      CheckCircle2,
  task_on_time_bonus: Clock,
  group_task_complete: Users,
  achievement_earned: Trophy,
  streak_7_bonus:     Flame,
  streak_14_bonus:    Flame,
  streak_30_bonus:    Flame,
  referral:           Link2,
  schedule_view:      CalendarDays,
  message_sent:       MessageCircle,
};

/* ─── Breakdown Icon Map ─── */
const BREAKDOWN_ICONS = {
  visits:             CalendarCheck,
  tasks:              CheckCircle2,
  task_on_time_bonus: Clock,
  group_tasks:        Users,
  achievements:       Trophy,
  streak_bonuses:     Flame,
  referrals:          Link2,
  messages:           MessageCircle,
  schedule_views:     CalendarDays,
  bonus:              Gift,
};

/* ─── Breakdown Colors ─── */
const BREAKDOWN_COLORS = {
  visits:             '#10B981',
  tasks:              '#3B82F6',
  task_on_time_bonus: '#60A5FA',
  group_tasks:        '#8B5CF6',
  achievements:       '#F59E0B',
  streak_bonuses:     '#EF4444',
  referrals:          '#06B6D4',
  messages:           '#EC4899',
  schedule_views:     '#14B8A6',
  bonus:              '#A78BFA',
};

const BREAKDOWN_LABELS = {
  visits:             'Ежедневные визиты',
  tasks:              'Задачи',
  task_on_time_bonus: 'Бонус за вовремя',
  group_tasks:        'Групповые задачи',
  achievements:       'Достижения',
  streak_bonuses:     'Бонусы стрика',
  referrals:          'Рефералы',
  messages:           'Сообщения',
  schedule_views:     'Просмотры расписания',
  bonus:              'Бонусный XP',
};


/**
 * LevelDetailModal v4.0 — Психология-ориентированный дизайн
 *
 * Принципы:
 * 1. Goal Gradient Effect — пульсация при приближении к цели
 * 2. Endowed Progress — всегда показываем прогресс (никогда 0%)
 * 3. Variable Reward — множественные пути заработка XP
 * 4. Zeigarnik Effect — незаконченный прогресс мотивирует
 * 5. Social Identity — тир как статус
 */
export default function LevelDetailModal({ isOpen, onClose, levelData, hapticFeedback, telegramId }) {
  const overlayRef = useRef(null);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [activeTab, setActiveTab] = useState('progress');
  const [xpRewards, setXpRewards] = useState(null);
  const [xpBreakdown, setXpBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [dailyXp, setDailyXp] = useState(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setAnimateProgress(false);
      const t = setTimeout(() => setAnimateProgress(true), 200);
      return () => clearTimeout(t);
    }
  }, [isOpen, levelData?.xp]);

  useEffect(() => {
    if (isOpen && !xpRewards) {
      friendsAPI.getXPRewardsInfo()
        .then(data => setXpRewards(data?.rewards || []))
        .catch(() => {});
    }
  }, [isOpen, xpRewards]);

  useEffect(() => {
    if (isOpen && activeTab === 'stats' && telegramId && !xpBreakdown && !loadingBreakdown) {
      setLoadingBreakdown(true);
      setErrorMsg(null);
      friendsAPI.getXPBreakdown(telegramId)
        .then(data => setXpBreakdown(data))
        .catch(() => setErrorMsg('Не удалось загрузить данные'))
        .finally(() => setLoadingBreakdown(false));
    }
  }, [isOpen, activeTab, telegramId, xpBreakdown, loadingBreakdown]);

  useEffect(() => {
    if (isOpen && telegramId && !dailyXp && !loadingDaily) {
      setLoadingDaily(true);
      friendsAPI.getDailyXP(telegramId)
        .then(data => setDailyXp(data))
        .catch(() => {})
        .finally(() => setLoadingDaily(false));
    }
  }, [isOpen, telegramId, dailyXp, loadingDaily]);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab('progress');
      setXpBreakdown(null);
      setDailyXp(null);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!levelData) return null;

  const {
    level = 1, tier = 'base', xp = 0,
    xp_current_level = 0, xp_next_level = 100,
    progress = 0, stars = 1, title = '',
  } = levelData;

  const tc = getTierConfig(tier);
  const xpInLevel = Math.max(0, xp - xp_current_level);
  const xpNeeded = Math.max(1, xp_next_level - xp_current_level);
  const xpRemaining = xpNeeded - xpInLevel;
  const pct = Math.round(progress * 100);
  const almostThere = progress >= 0.75 && progress < 1.0;
  const isHighTier = tier === 'premium' || tier === 'legend';
  const TierIcon = TIER_ICONS[tier] || Shield;
  const dailyTotal = dailyXp?.total_xp_today || 0;

  const tabs = [
    { id: 'progress', label: 'Прогресс', Icon: TrendingUp },
    { id: 'earn',     label: 'Как получить', Icon: Zap },
    { id: 'stats',    label: 'Статистика',  Icon: BarChart3 },
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
          style={overlayStyle}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            style={sheetStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={handleStyle} />

            {/* ─── Header: Level Ring + Info ─── */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              {/* Circular Progress Ring */}
              <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 12px' }}>
                <ProgressRing
                  progress={animateProgress ? progress : 0}
                  color={tc.color}
                  secondaryColor={tc.colorSecondary}
                  size={120}
                  strokeWidth={6}
                  isHighTier={isHighTier}
                  almostThere={almostThere}
                />
                {/* Center content */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontFamily: "'Poppins', sans-serif", fontWeight: 800,
                    fontSize: '32px', lineHeight: 1,
                    color: tc.color,
                    filter: `drop-shadow(0 0 8px ${tc.glow})`,
                  }}>
                    {level}
                  </span>
                  <span style={{
                    fontFamily: "'Poppins', sans-serif", fontWeight: 500,
                    fontSize: '10px', color: 'rgba(255,255,255,0.4)',
                    marginTop: '2px', letterSpacing: '0.5px',
                  }}>
                    УРОВЕНЬ
                  </span>
                </div>
              </div>

              {/* Stars */}
              <div style={{
                fontSize: '16px', letterSpacing: '3px',
                color: tc.color, marginBottom: '6px',
                filter: `drop-shadow(0 0 4px ${tc.color}44)`,
              }}>
                {renderStars(stars)}
              </div>

              {/* Tier badge + title */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 14px', borderRadius: '16px',
                background: tc.bgTint, border: `1px solid ${tc.borderTint}`,
              }}>
                <TierIcon size={14} color={tc.color} strokeWidth={2.5} />
                <span style={{
                  fontFamily: "'Poppins', sans-serif", fontWeight: 600,
                  fontSize: '12px', color: tc.color,
                }}>
                  {tc.nameRu}
                </span>
                {title && (
                  <>
                    <span style={{ color: `${tc.color}44`, fontSize: '10px' }}>|</span>
                    <span style={{
                      fontFamily: "'Poppins', sans-serif", fontWeight: 400,
                      fontSize: '11px', color: `${tc.color}88`,
                    }}>
                      {title}
                    </span>
                  </>
                )}
              </div>

              {/* XP counter */}
              <div style={{
                fontFamily: "'Poppins', sans-serif", fontWeight: 500,
                fontSize: '13px', color: 'rgba(255,255,255,0.35)',
                marginTop: '8px',
              }}>
                {xp.toLocaleString()} XP
              </div>
            </div>

            {/* Daily XP mini widget */}
            {dailyTotal > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', marginBottom: '14px', padding: '8px 16px',
                  borderRadius: '12px', background: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.14)',
                }}
              >
                <Zap size={14} color="#10B981" strokeWidth={2.5} />
                <span style={{
                  fontFamily: "'Poppins', sans-serif", fontWeight: 600,
                  fontSize: '12px', color: '#10B981',
                }}>
                  +{dailyTotal} XP сегодня
                </span>
              </motion.div>
            )}

            {/* ─── Tabs ─── */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    setActiveTab(id);
                    if (hapticFeedback) hapticFeedback('impact', 'light');
                  }}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: '12px',
                    border: activeTab === id ? `1px solid ${tc.color}30` : '1px solid rgba(255,255,255,0.05)',
                    background: activeTab === id ? `${tc.color}0D` : 'transparent',
                    fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '11px',
                    color: activeTab === id ? tc.color : 'rgba(255,255,255,0.3)',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  }}
                >
                  <Icon size={12} strokeWidth={2.5} />
                  {label}
                </button>
              ))}
            </div>

            {/* ═══ TAB: Progress ═══ */}
            {activeTab === 'progress' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                {/* Linear progress bar */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={labelSm}>LV. {level}</span>
                    <span style={{ ...labelSm, color: almostThere ? tc.color : 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                      {xpInLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP
                    </span>
                    <span style={labelSm}>LV. {level + 1}</span>
                  </div>

                  <div style={{
                    height: '10px', borderRadius: '5px',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    overflow: 'hidden', position: 'relative',
                  }}>
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: animateProgress ? `${Math.max(pct, 1)}%` : '0%' }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      style={{
                        height: '100%', borderRadius: '5px',
                        background: tc.gradient,
                        boxShadow: almostThere ? `0 0 16px ${tc.color}66` : `0 0 8px ${tc.color}33`,
                      }}
                    />
                  </div>

                  {/* Goal Gradient: intensify message as user approaches */}
                  <div style={{
                    textAlign: 'center', marginTop: '8px',
                    fontFamily: "'Poppins', sans-serif", fontSize: '12px',
                    fontWeight: almostThere ? 600 : 400,
                    color: almostThere ? tc.color : 'rgba(255,255,255,0.3)',
                  }}>
                    {progress >= 0.90
                      ? <><Flame size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> Осталось всего {xpRemaining.toLocaleString()} XP!</>
                      : progress >= 0.75
                        ? <><Target size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> Почти! {xpRemaining.toLocaleString()} XP до цели</>
                        : `${pct}% — ещё ${xpRemaining.toLocaleString()} XP`
                    }
                  </div>
                </div>

                {/* ─── Tier Roadmap (horizontal) ─── */}
                <SectionTitle icon={<Sparkles size={13} color={tc.color} />} text="Дорожная карта" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' }}>
                  {TIER_RANGES.map((range) => {
                    const rtc = TIER_CONFIG[range.tier];
                    const isActive = tier === range.tier;
                    const isPast = getTierIndex(tier) > getTierIndex(range.tier);
                    const isFuture = getTierIndex(tier) < getTierIndex(range.tier);
                    const isNext = getTierIndex(range.tier) === getTierIndex(tier) + 1;
                    const RIcon = TIER_ICONS[range.tier] || Shield;
                    return (
                      <div
                        key={range.tier}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '9px 12px', borderRadius: '12px',
                          backgroundColor: isActive ? rtc.bgTint : 'rgba(255,255,255,0.015)',
                          border: isActive
                            ? `1.5px solid ${rtc.borderTint}`
                            : isNext
                              ? `1px dashed ${rtc.color}20`
                              : '1px solid rgba(255,255,255,0.03)',
                          opacity: isFuture && !isNext ? 0.35 : 1,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '8px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isPast ? `${rtc.color}18` : isActive ? `${rtc.color}22` : 'rgba(255,255,255,0.03)',
                          border: isActive ? `1.5px solid ${rtc.color}55` : 'none',
                          flexShrink: 0,
                        }}>
                          {isPast
                            ? <CircleCheckBig size={14} color={rtc.color} strokeWidth={2.5} />
                            : isFuture
                              ? <Lock size={12} color="rgba(255,255,255,0.2)" />
                              : <RIcon size={14} color={rtc.color} strokeWidth={2.5} />
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontWeight: isActive ? 700 : 500, fontSize: '12px',
                            color: isActive ? rtc.color : isPast ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.28)',
                          }}>
                            {rtc.nameRu}
                            {isActive && (
                              <span style={{
                                fontSize: '10px', marginLeft: '6px', opacity: 0.6,
                                fontWeight: 400,
                              }}>
                                — вы здесь
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontFamily: "'Poppins', sans-serif", fontWeight: 400,
                            fontSize: '10px', color: 'rgba(255,255,255,0.2)',
                          }}>
                            Ур. {range.min}–{range.max}
                          </div>
                        </div>
                        {isActive && (
                          <div style={{
                            fontSize: '13px', color: rtc.color,
                            letterSpacing: '1px', flexShrink: 0,
                          }}>
                            {renderStars(stars)}
                          </div>
                        )}
                        {isNext && (
                          <ChevronRight size={14} color={rtc.color} style={{ opacity: 0.4, flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ═══ TAB: How to Earn XP ═══ */}
            {activeTab === 'earn' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                {/* Visual XP Potential Chart */}
                <SectionTitle icon={<BarChart3 size={13} color={tc.color} />} text="Потенциал за день" />
                {xpRewards && xpRewards.length > 0 ? (
                  <XPPotentialChart rewards={xpRewards} tierColor={tc.color} />
                ) : (
                  <LoadingState color={tc.color} />
                )}

                {/* Action cards */}
                <SectionTitle icon={<Zap size={13} color={tc.color} />} text="Все способы" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(xpRewards || []).map((reward, idx) => {
                    const AIcon = ACTION_ICONS[reward.action] || Star;
                    return (
                      <motion.div
                        key={reward.action}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.025 }}
                        style={cardStyle}
                      >
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: `${tc.color}0D`, flexShrink: 0,
                        }}>
                          <AIcon size={15} color={tc.color} strokeWidth={2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: "'Poppins', sans-serif", fontWeight: 500,
                            fontSize: '13px', color: '#F0EFF5',
                          }}>
                            {reward.label}
                          </div>
                          {reward.limit && (
                            <div style={{
                              fontFamily: "'Poppins', sans-serif", fontWeight: 400,
                              fontSize: '10px', color: 'rgba(255,255,255,0.22)', marginTop: '1px',
                            }}>
                              {reward.limit}
                            </div>
                          )}
                        </div>
                        <div style={{
                          fontFamily: "'Poppins', sans-serif", fontWeight: 700,
                          fontSize: '14px', color: tc.color, flexShrink: 0,
                        }}>
                          +{reward.xp}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                {!xpRewards && <LoadingState color={tc.color} />}
              </motion.div>
            )}

            {/* ═══ TAB: Stats ═══ */}
            {activeTab === 'stats' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                <SectionTitle icon={<BarChart3 size={13} color={tc.color} />} text="Откуда ваш XP" />

                {errorMsg ? (
                  <div style={{ textAlign: 'center', padding: '24px', fontFamily: "'Poppins', sans-serif", fontSize: '12px', color: '#EF4444' }}>
                    {errorMsg}
                  </div>
                ) : xpBreakdown?.breakdown ? (
                  <>
                    {/* Donut chart */}
                    <XPDonutChart
                      breakdown={xpBreakdown.breakdown}
                      totalXP={xpBreakdown.xp || 1}
                      tierColor={tc.color}
                    />

                    {/* Breakdown list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
                      {Object.entries(xpBreakdown.breakdown)
                        .filter(([, val]) => val > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([key, value], idx) => {
                          const BIcon = BREAKDOWN_ICONS[key] || Star;
                          const bColor = BREAKDOWN_COLORS[key] || tc.color;
                          const bLabel = BREAKDOWN_LABELS[key] || key;
                          const percent = Math.round((value / (xpBreakdown.xp || 1)) * 100);
                          return (
                            <motion.div
                              key={key}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              style={cardStyle}
                            >
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '7px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: `${bColor}14`, flexShrink: 0,
                              }}>
                                <BIcon size={13} color={bColor} strokeWidth={2} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontFamily: "'Poppins', sans-serif", fontWeight: 500,
                                  fontSize: '12px', color: '#F0EFF5',
                                }}>
                                  {bLabel}
                                </div>
                                {/* Mini bar */}
                                <div style={{
                                  height: '3px', borderRadius: '1.5px', marginTop: '4px',
                                  backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden',
                                }}>
                                  <motion.div
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${percent}%` }}
                                    transition={{ duration: 0.4, delay: idx * 0.03 }}
                                    style={{ height: '100%', borderRadius: '1.5px', backgroundColor: bColor }}
                                  />
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{
                                  fontFamily: "'Poppins', sans-serif", fontWeight: 700,
                                  fontSize: '13px', color: bColor,
                                }}>
                                  {value.toLocaleString()}
                                </div>
                                <div style={{
                                  fontFamily: "'Poppins', sans-serif", fontWeight: 400,
                                  fontSize: '10px', color: 'rgba(255,255,255,0.25)',
                                }}>
                                  {percent}%
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                    </div>

                    {/* Total */}
                    <div style={{
                      padding: '12px 14px', borderRadius: '12px',
                      background: tc.bgTint, border: `1px solid ${tc.borderTint}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginTop: '8px',
                    }}>
                      <span style={{
                        fontFamily: "'Poppins', sans-serif", fontWeight: 600,
                        fontSize: '13px', color: '#F0EFF5',
                      }}>Итого</span>
                      <span style={{
                        fontFamily: "'Poppins', sans-serif", fontWeight: 700,
                        fontSize: '15px', color: tc.color,
                      }}>
                        {(xpBreakdown.xp || 0).toLocaleString()} XP
                      </span>
                    </div>
                  </>
                ) : (
                  <LoadingState color={tc.color} />
                )}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


/* ═══════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════ */

/* ── Circular Progress Ring ── */
function ProgressRing({ progress, color, secondaryColor, size, strokeWidth, isHighTier, almostThere }) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={secondaryColor || color} />
        </linearGradient>
        {almostThere && (
          <filter id="ringGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      {/* Background track */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="url(#ringGrad)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - clampedProgress) }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        filter={almostThere ? 'url(#ringGlow)' : undefined}
      />
    </svg>
  );
}


/* ── XP Potential Chart — visual bar showing daily earning potential ── */
function XPPotentialChart({ rewards, tierColor }) {
  // Group and calculate max daily potential
  const dailyActions = [
    { key: 'daily_visit',        label: 'Визит',       xp: 3,  limit: 1 },
    { key: 'schedule_view',      label: 'Расписание',  xp: 3,  limit: 3 },
    { key: 'message_sent',       label: 'Сообщения',   xp: 5,  limit: 5 },
    { key: 'task_complete',      label: 'Задачи',      xp: 15, limit: 3 },
    { key: 'task_on_time_bonus', label: 'Вовремя',     xp: 9,  limit: 3 },
  ];

  const totalDaily = dailyActions.reduce((s, a) => s + a.xp, 0);
  const maxBar = Math.max(...dailyActions.map(a => a.xp));

  const barColors = ['#10B981', '#14B8A6', '#EC4899', '#3B82F6', '#60A5FA'];

  return (
    <div style={{
      padding: '14px', borderRadius: '14px',
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
      marginBottom: '16px',
    }}>
      {/* Total badge */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '14px',
      }}>
        <span style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 500,
          fontSize: '11px', color: 'rgba(255,255,255,0.4)',
        }}>
          Ежедневный максимум
        </span>
        <span style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 700,
          fontSize: '14px', color: tierColor,
        }}>
          ~{totalDaily} XP
        </span>
      </div>

      {/* Horizontal bars */}
      {dailyActions.map((action, idx) => {
        const bColor = barColors[idx % barColors.length];
        const Icon = ACTION_ICONS[action.key] || Star;
        const widthPct = Math.round((action.xp / maxBar) * 100);
        return (
          <div key={action.key} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: idx < dailyActions.length - 1 ? '8px' : 0,
          }}>
            <div style={{ width: '70px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Icon size={11} color={bColor} strokeWidth={2.5} />
              <span style={{
                fontFamily: "'Poppins', sans-serif", fontWeight: 500,
                fontSize: '10px', color: 'rgba(255,255,255,0.45)',
              }}>
                {action.label}
              </span>
            </div>
            <div style={{ flex: 1, height: '14px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.03)', overflow: 'hidden', position: 'relative' }}>
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: `${widthPct}%` }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                style={{
                  height: '100%', borderRadius: '4px',
                  background: `linear-gradient(90deg, ${bColor}CC, ${bColor})`,
                }}
              />
              <span style={{
                position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                fontFamily: "'Poppins', sans-serif", fontWeight: 700,
                fontSize: '9px', color: widthPct > 30 ? '#fff' : 'rgba(255,255,255,0.4)',
                zIndex: 1,
              }}>
                +{action.xp}
              </span>
            </div>
          </div>
        );
      })}

      {/* Footnote */}
      <div style={{
        marginTop: '10px', fontFamily: "'Poppins', sans-serif",
        fontSize: '10px', color: 'rgba(255,255,255,0.18)', textAlign: 'center',
      }}>
        + бонусы за стрик, рефералы, достижения
      </div>
    </div>
  );
}


/* ── XP Donut Chart ── */
function XPDonutChart({ breakdown, totalXP, tierColor }) {
  const entries = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return null;

  const size = 140;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = entries.map(([key, value]) => {
    const pct = value / totalXP;
    const seg = { key, value, pct, offset, color: BREAKDOWN_COLORS[key] || tierColor };
    offset += pct;
    return seg;
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '16px', padding: '12px',
      borderRadius: '14px', background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)"
          strokeWidth={strokeWidth}
        />
        {segments.map((seg) => (
          <motion.circle
            key={seg.key}
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={seg.color}
            strokeWidth={strokeWidth - 2}
            strokeLinecap="round"
            strokeDasharray={`${circumference * seg.pct * 0.95} ${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - seg.offset) + circumference * seg.pct * 0.025 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          />
        ))}
        {/* Center text (rotated back) */}
        <text
          x={size / 2} y={size / 2 - 4}
          textAnchor="middle" dominantBaseline="central"
          fill={tierColor}
          fontSize="18" fontWeight="800"
          fontFamily="Poppins, sans-serif"
          transform={`rotate(90, ${size / 2}, ${size / 2})`}
        >
          {totalXP.toLocaleString()}
        </text>
        <text
          x={size / 2} y={size / 2 + 14}
          textAnchor="middle" dominantBaseline="central"
          fill="rgba(255,255,255,0.3)"
          fontSize="9" fontWeight="500"
          fontFamily="Poppins, sans-serif"
          transform={`rotate(90, ${size / 2}, ${size / 2})`}
        >
          XP
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
        {segments.slice(0, 5).map((seg) => (
          <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '2px',
              backgroundColor: seg.color, flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "'Poppins', sans-serif", fontWeight: 400,
              fontSize: '10px', color: 'rgba(255,255,255,0.4)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {BREAKDOWN_LABELS[seg.key] || seg.key}
            </span>
          </div>
        ))}
        {segments.length > 5 && (
          <span style={{
            fontFamily: "'Poppins', sans-serif", fontWeight: 400,
            fontSize: '9px', color: 'rgba(255,255,255,0.2)',
          }}>
            +{segments.length - 5} других
          </span>
        )}
      </div>
    </div>
  );
}


/* ── SectionTitle ── */
function SectionTitle({ icon, text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      marginBottom: '8px',
    }}>
      {icon}
      <span style={{
        fontFamily: "'Poppins', sans-serif", fontWeight: 500,
        fontSize: '11px', color: 'rgba(255,255,255,0.3)',
        letterSpacing: '0.3px',
      }}>
        {text}
      </span>
    </div>
  );
}


/* ── Loading ── */
function LoadingState({ color }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 0' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{
          width: '20px', height: '20px',
          border: `2px solid ${color}22`, borderTopColor: color,
          borderRadius: '50%', margin: '0 auto 8px',
        }}
      />
      <span style={{
        fontFamily: "'Poppins', sans-serif", fontSize: '12px',
        color: 'rgba(255,255,255,0.2)',
      }}>
        Загрузка...
      </span>
    </div>
  );
}


/* ── Styles ── */

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 9999,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
};

const sheetStyle = {
  width: '100%', maxWidth: '500px', maxHeight: '85vh',
  background: 'linear-gradient(180deg, #1A1A2E 0%, #16213E 100%)',
  borderRadius: '24px 24px 0 0',
  padding: '20px 18px 36px',
  position: 'relative',
  overflowY: 'auto', WebkitOverflowScrolling: 'touch',
};

const handleStyle = {
  width: '36px', height: '4px', borderRadius: '2px',
  backgroundColor: 'rgba(255,255,255,0.12)',
  margin: '0 auto 16px',
};

const cardStyle = {
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '10px 12px', borderRadius: '12px',
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.04)',
};

const labelSm = {
  fontFamily: "'Poppins', sans-serif", fontWeight: 500,
  fontSize: '11px', color: 'rgba(255,255,255,0.4)',
};
