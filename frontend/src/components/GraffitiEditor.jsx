import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Pen, Eraser, Undo2, Redo2, Trash2, AlertTriangle, Check } from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';

/* ────────────────────────────────────────────────
   Фиксированное логическое разрешение canvas
   ──────────────────────────────────────────────── */
const GRAFFITI_W = 500;
const GRAFFITI_H = 350;

const PEN_SIZES   = [2, 4, 8, 14];
const ERASER_SIZES = [8, 14, 22, 32];
const DEFAULT_PEN_SIZE    = 4;
const DEFAULT_ERASER_SIZE = 14;
const COLORS = ['#F8B94C', '#EF4444', '#3B82F6', '#10B981', '#A855F7', '#EC4899', '#FFFFFF', '#6B7280'];
const MAX_HISTORY = 30;

/**
 * GraffitiEditor — полноэкранный редактор граффити для шапки профиля.
 *
 * Исправления:
 * - FIX-1: loadFromServer теперь возвращает Promise, резолвящийся ПОСЛЕ img.onload
 * - FIX-2: loading state сбрасывается при каждом открытии
 * - FIX-3: clearing ref блокирует saveToServer во время clearCanvas
 * - FIX-4: handleDone ожидает завершение save
 * - FIX-5: setupCanvas корректно использует saveSnapshot через ref
 */
const GraffitiEditor = ({ isOpen, onClose, user, userSettings, profilePhoto, hapticFeedback, profileData, onGraffitiSaved }) => {
  // === Canvas refs ===
  const canvasRef    = useRef(null);
  const ctxRef       = useRef(null);
  const drawing      = useRef(false);
  const lastPt       = useRef(null);
  const colorRef     = useRef('#F8B94C');
  const sizeRef      = useRef(DEFAULT_PEN_SIZE);
  const toolRef      = useRef('pen');
  const loadedImgRef = useRef(null);
  const dirty        = useRef(false);
  const savingLock   = useRef(false);
  const cancelledRef = useRef(false);
  const clearingRef  = useRef(false); // FIX-3: защита от race condition clear + save

  // === Undo / Redo ===
  const history    = useRef([]);
  const historyIdx = useRef(-1);
  // FIX-5: saveSnapshot ref для стабильной ссылки в setupCanvas
  const saveSnapshotRef = useRef(null);

  // === UI state ===
  const [tool, setTool]                   = useState('pen');
  const [color, setColor]                 = useState('#F8B94C');
  const [size, setSize]                   = useState(DEFAULT_PEN_SIZE);
  const [canUndo, setCanUndo]             = useState(false);
  const [canRedo, setCanRedo]             = useState(false);
  const [hasContent, setHasContent]       = useState(false);
  const [saveStatus, setSaveStatus]       = useState('idle'); // idle | saving | saved | error
  const [loading, setLoading]             = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [imgLoaded, setImgLoaded]         = useState(false);

  // Sync state → refs
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current  = size;  }, [size]);
  useEffect(() => { toolRef.current  = tool;  }, [tool]);

  // === Canvas helpers ===
  const checkHasContent = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    if (!canvas || !ctx) { setHasContent(false); return false; }
    try {
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] > 0) { setHasContent(true); return true; }
      }
      setHasContent(false);
      return false;
    } catch { return false; }
  }, []);

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    if (!canvas || !ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const idx = historyIdx.current;
    history.current = history.current.slice(0, idx + 1);
    history.current.push(imgData);
    if (history.current.length > MAX_HISTORY) history.current.shift();
    historyIdx.current = history.current.length - 1;
    setCanUndo(historyIdx.current > 0);
    setCanRedo(false);
    dirty.current = true;
    checkHasContent();
  }, [checkHasContent]);

  // FIX-5: обновляем ref при изменении saveSnapshot
  useEffect(() => { saveSnapshotRef.current = saveSnapshot; }, [saveSnapshot]);

  const setupCanvas = useCallback((canvas, skipSnapshot) => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const tW  = GRAFFITI_W * dpr;
    const tH  = GRAFFITI_H * dpr;
    if (canvas.width === tW && canvas.height === tH && ctxRef.current) return;
    canvas.width  = tW;
    canvas.height = tH;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;
    // FIX-5: вызываем через ref для актуальной ссылки
    if (!skipSnapshot && saveSnapshotRef.current) saveSnapshotRef.current();
  }, []);

  // === Coordinate helper ===
  const getXY = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let cx, cy;
    if (e.touches?.length > 0)        { cx = e.touches[0].clientX;        cy = e.touches[0].clientY; }
    else if (e.changedTouches?.length > 0) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
    else                               { cx = e.clientX;                   cy = e.clientY; }
    return {
      x: (cx - rect.left) * (GRAFFITI_W / rect.width),
      y: (cy - rect.top)  * (GRAFFITI_H / rect.height),
    };
  }, []);

  // === Undo / Redo ===
  const undo = useCallback(() => {
    if (historyIdx.current <= 0) return;
    historyIdx.current -= 1;
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.putImageData(history.current[historyIdx.current], 0, 0);
    setCanUndo(historyIdx.current > 0);
    setCanRedo(true);
    dirty.current = true;
    checkHasContent();
    if (hapticFeedback) hapticFeedback('impact', 'light');
  }, [hapticFeedback, checkHasContent]);

  const redo = useCallback(() => {
    if (historyIdx.current >= history.current.length - 1) return;
    historyIdx.current += 1;
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.putImageData(history.current[historyIdx.current], 0, 0);
    setCanUndo(true);
    setCanRedo(historyIdx.current < history.current.length - 1);
    dirty.current = true;
    checkHasContent();
    if (hapticFeedback) hapticFeedback('impact', 'light');
  }, [hapticFeedback, checkHasContent]);

  // === Clear ===
  const clearCanvas = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    // FIX-3: помечаем что идёт очистка — блокирует saveToServer
    clearingRef.current = true;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, GRAFFITI_W, GRAFFITI_H);
    history.current    = [];
    historyIdx.current = -1;
    setCanUndo(false);
    setCanRedo(false);
    saveSnapshot();
    dirty.current = false; // FIX-3: сразу false, чтобы handleDone не пытался сохранить
    setHasContent(false);
    setShowClearConfirm(false);
    if (hapticFeedback) hapticFeedback('notification', 'success');
    if (user?.id) {
      try {
        await friendsAPI.clearGraffiti(user.id);
        if (onGraffitiSaved) onGraffitiSaved(null);
      } catch (err) {
        console.error('[GraffitiEditor] Clear error:', err);
      }
    }
    clearingRef.current = false;
  }, [saveSnapshot, hapticFeedback, user?.id, onGraffitiSaved]);

  // === Save ===
  const saveToServer = useCallback(async () => {
    const canvas = canvasRef.current;
    // FIX-3: не сохраняем если идёт очистка
    if (!canvas || !user?.id || !dirty.current || savingLock.current || clearingRef.current) return;
    savingLock.current = true;
    setSaveStatus('saving');
    try {
      const NORM_W = GRAFFITI_W * 2;
      const NORM_H = GRAFFITI_H * 2;
      const off = document.createElement('canvas');
      off.width = NORM_W; off.height = NORM_H;
      off.getContext('2d').drawImage(canvas, 0, 0, NORM_W, NORM_H);

      const testC = document.createElement('canvas');
      testC.width = 1; testC.height = 1;
      const webp = testC.toDataURL('image/webp').startsWith('data:image/webp');
      let url = webp ? off.toDataURL('image/webp', 0.85) : off.toDataURL('image/png');
      if (url.length > 3 * 1024 * 1024 && webp) url = off.toDataURL('image/webp', 0.6);
      if (url.length > 3 * 1024 * 1024) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
        savingLock.current = false;
        return;
      }

      await friendsAPI.saveGraffiti(user.id, url);
      dirty.current = false;
      setSaveStatus('saved');
      if (onGraffitiSaved) onGraffitiSaved(url);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('[GraffitiEditor] Save error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally { savingLock.current = false; }
  }, [user?.id, onGraffitiSaved]);

  // === Load ===
  // FIX-1: возвращает Promise, который резолвится ПОСЛЕ загрузки изображения
  const loadFromServer = useCallback(() => {
    return new Promise(async (resolve) => {
      const canvas = canvasRef.current;
      if (!canvas || !user?.id) { resolve(false); return; }
      // Отмена предыдущей загрузки
      if (loadedImgRef.current) {
        loadedImgRef.current.onload  = null;
        loadedImgRef.current.onerror = null;
        loadedImgRef.current = null;
      }
      cancelledRef.current = false;
      setLoading(true);
      try {
        const data = await friendsAPI.getGraffiti(user.id);
        if (cancelledRef.current) { setLoading(false); resolve(false); return; }
        if (!data?.graffiti_data)  { setLoading(false); resolve(false); return; }

        const img = new window.Image();
        loadedImgRef.current = img;

        img.onload = () => {
          if (cancelledRef.current || !canvasRef.current) { setLoading(false); resolve(false); return; }
          const ctx = ctxRef.current;
          if (!ctx) { setLoading(false); resolve(false); return; }
          const iW = img.naturalWidth, iH = img.naturalHeight;
          if (iW > 0 && iH > 0) {
            const iA = iW / iH, cA = GRAFFITI_W / GRAFFITI_H;
            let dW, dH, dX, dY;
            if (Math.abs(iA - cA) < 0.05) { dW = GRAFFITI_W; dH = GRAFFITI_H; dX = 0; dY = 0; }
            else if (iA > cA) { dW = GRAFFITI_W; dH = GRAFFITI_W / iA; dX = 0; dY = (GRAFFITI_H - dH) / 2; }
            else               { dH = GRAFFITI_H; dW = GRAFFITI_H * iA; dX = (GRAFFITI_W - dW) / 2; dY = 0; }
            ctx.drawImage(img, dX, dY, dW, dH);
          } else {
            ctx.drawImage(img, 0, 0, GRAFFITI_W, GRAFFITI_H);
          }
          // FIX-1: snapshot сохраняется ПОСЛЕ отрисовки — это будет единственный начальный snapshot
          saveSnapshot();
          dirty.current = false;
          setHasContent(true);
          setLoading(false);
          loadedImgRef.current = null;
          resolve(true); // изображение загружено
        };

        img.onerror = () => {
          setLoading(false);
          loadedImgRef.current = null;
          resolve(false);
        };

        img.src = data.graffiti_data;
      } catch (err) {
        console.error('[GraffitiEditor] Load error:', err);
        setLoading(false);
        resolve(false);
      }
    });
  }, [user?.id, saveSnapshot]);

  // === Canvas event listeners ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;

    const onDown = (e) => {
      e.preventDefault();
      if (!ctxRef.current) setupCanvas(canvas);
      drawing.current = true;
      const pt = getXY(e);
      if (!pt) return;
      lastPt.current = pt;
      const ctx = ctxRef.current;
      if (!ctx) return;
      const isEraser = toolRef.current === 'eraser';
      ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, sizeRef.current / 2, 0, Math.PI * 2);
      ctx.fillStyle = isEraser ? 'rgba(0,0,0,1)' : colorRef.current;
      ctx.fill();
    };

    const onMove = (e) => {
      if (!drawing.current) return;
      e.preventDefault();
      const ctx = ctxRef.current;
      if (!ctx) return;
      const pt = getXY(e);
      if (!pt) return;
      const last = lastPt.current;
      if (last) {
        const isEraser = toolRef.current === 'eraser';
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : colorRef.current;
        ctx.lineWidth = sizeRef.current;
        ctx.stroke();
      }
      lastPt.current = pt;
    };

    const onUp = () => {
      if (drawing.current) {
        drawing.current = false;
        lastPt.current  = null;
        const ctx = ctxRef.current;
        if (ctx) ctx.globalCompositeOperation = 'source-over';
        saveSnapshot();
      }
    };

    canvas.addEventListener('touchstart',  onDown, { passive: false });
    canvas.addEventListener('touchmove',   onMove, { passive: false });
    canvas.addEventListener('touchend',    onUp);
    canvas.addEventListener('touchcancel', onUp);
    canvas.addEventListener('mousedown',   onDown);
    canvas.addEventListener('mousemove',   onMove);
    canvas.addEventListener('mouseup',     onUp);
    canvas.addEventListener('mouseleave',  onUp);

    return () => {
      canvas.removeEventListener('touchstart',  onDown);
      canvas.removeEventListener('touchmove',   onMove);
      canvas.removeEventListener('touchend',    onUp);
      canvas.removeEventListener('touchcancel', onUp);
      canvas.removeEventListener('mousedown',   onDown);
      canvas.removeEventListener('mousemove',   onMove);
      canvas.removeEventListener('mouseup',     onUp);
      canvas.removeEventListener('mouseleave',  onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, setupCanvas, saveSnapshot, getXY]);

  // === Init + load ===
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let cancelled = false;
    cancelledRef.current = false;
    dirty.current    = false;
    clearingRef.current = false;
    history.current    = [];
    historyIdx.current = -1;
    setCanUndo(false);
    setCanRedo(false);
    setHasContent(false);
    setSaveStatus('idle');
    setShowClearConfirm(false);
    setImgLoaded(false);
    setLoading(false); // FIX-2: явно сбрасываем loading при каждом открытии

    const t = setTimeout(async () => {
      if (cancelled) return;
      if (canvasRef.current) setupCanvas(canvasRef.current, true);
      // FIX-1: ждём реальной загрузки изображения
      const loaded = await loadFromServer();
      if (cancelled) return;
      // Если ничего не загрузилось — создаём начальный пустой snapshot
      if (!loaded) {
        saveSnapshot();
        dirty.current = false;
      }
    }, 150);

    return () => {
      cancelled = true;
      cancelledRef.current = true;
      clearTimeout(t);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // === Cleanup on close ===
  useEffect(() => {
    if (!isOpen) {
      if (loadedImgRef.current) {
        loadedImgRef.current.onload  = null;
        loadedImgRef.current.onerror = null;
        loadedImgRef.current = null;
      }
      history.current    = [];
      historyIdx.current = -1;
      ctxRef.current     = null;
      dirty.current      = false;
      savingLock.current  = false;
      clearingRef.current = false;
      setLoading(false); // FIX-2: сбрасываем и при закрытии
    }
  }, [isOpen]);

  // === Handle "Готово" ===
  // FIX-4: handleDone теперь async и ожидает save
  const handleDone = useCallback(async () => {
    if (dirty.current && !clearingRef.current) await saveToServer();
    if (hapticFeedback) hapticFeedback('impact', 'light');
    onClose();
  }, [saveToServer, hapticFeedback, onClose]);

  if (!isOpen) return null;

  const initial     = (user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase();
  const displayName = (user?.username || user?.first_name || 'User').toUpperCase();
  const groupName   = userSettings?.group_name || '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[400] flex flex-col"
      style={{ backgroundColor: '#000000' }}
    >
      {/* ─── Верхняя панель ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2 }}
        className="flex items-center justify-between px-4"
        style={{
          paddingTop: 'calc(var(--header-safe-padding, 0px) + 12px)',
          paddingBottom: '8px',
          flexShrink: 0,
        }}
      >
        <button onClick={async () => { if (dirty.current && !clearingRef.current) await saveToServer(); onClose(); }}>
          <ChevronLeft style={{ width: '28px', height: '28px', color: 'rgba(255,255,255,0.7)' }} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Pen style={{ width: '15px', height: '15px', color: '#F8B94C' }} />
          <span style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize: '15px',
            color: '#F4F3FC',
          }}>
            Граффити шапки
          </span>
          {saveStatus === 'saving' && (
            <span style={{ fontSize: '11px', color: 'rgba(248,185,76,0.7)', animation: 'pulse 1s infinite' }}>
              Сохранение...
            </span>
          )}
          {saveStatus === 'saved' && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: '11px', color: '#10B981' }}>
              ✓
            </motion.span>
          )}
          {saveStatus === 'error' && (
            <span style={{ fontSize: '11px', color: '#EF4444' }}>Ошибка</span>
          )}
        </div>

        <button
          onClick={handleDone}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 14px',
            borderRadius: '12px',
            background: 'rgba(248,185,76,0.15)',
            border: '1px solid rgba(248,185,76,0.35)',
            cursor: 'pointer',
          }}
        >
          <Check style={{ width: '16px', height: '16px', color: '#F8B94C' }} />
          <span style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize: '13px',
            color: '#F8B94C',
          }}>
            Готово
          </span>
        </button>
      </motion.div>

      {/* ─── Основная область — Canvas + Preview ─── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '0 12px',
      }}>
        {/* Canvas контейнер с ghost-preview профиля */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.25 }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '500px',
            margin: '0 auto',
            aspectRatio: `${GRAFFITI_W} / ${GRAFFITI_H}`,
            borderRadius: '24px',
            overflow: 'hidden',
            border: '1.5px solid rgba(248,185,76,0.2)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          {/* Ghost preview профиля */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: 0.18,
            zIndex: 1,
            padding: '8px 12px 10px',
            gap: '3px',
          }}>
            {/* Avatar ghost */}
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '24px',
              overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.3)',
              flexShrink: 0,
            }}>
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: imgLoaded ? 1 : 0,
                  }}
                  onLoad={() => setImgLoaded(true)}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '22px',
                }}>
                  {initial}
                </div>
              )}
            </div>

            {/* Online/Offline + Level бейджи */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '2px',
            }}>
              {/* Online/Offline */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#4ADE80',
                }} />
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 500,
                  fontSize: '9px',
                  color: '#FFFFFF',
                }}>
                  Online
                </span>
              </div>

              {/* Level бейдж */}
              <div style={{
                padding: '3px 10px',
                borderRadius: '14px',
                background: '#F8B94C',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '9px',
                  color: '#1c1c1c',
                }}>
                  LV. {profileData?.level ?? 1}
                </span>
              </div>
            </div>

            {/* Username ghost */}
            <span style={{
              fontFamily: "'Proxima Nova ExCn', sans-serif",
              fontWeight: 800,
              fontSize: '26px',
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: 1.1,
            }}>
              {displayName}
            </span>

            {/* Group + Trophy + Streak ghost */}
            {groupName && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '11px',
                  color: '#FF4E9D',
                  textAlign: 'center',
                }}>
                  {groupName}
                </span>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '10px',
                  color: '#FFB54E',
                }}>
                  🏆 🔥{profileData?.visit_streak_current ?? 0}
                </span>
              </div>
            )}

            {/* Stats ghost: Друзья / Уровень / $RDN */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              marginTop: '3px',
            }}>
              {[
                { val: profileData?.friends_count ?? 0, label: 'Друзья' },
                { val: profileData?.total_points ?? 0, label: '$RDN' },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '13px', color: '#FFBE4E' }}>{s.val}</div>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500, fontSize: '9px', color: '#FFF' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas — рисовалка */}
          <canvas
            ref={canvasRef}
            style={{
              position: 'relative',
              zIndex: 2,
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: tool === 'eraser' ? 'cell' : 'crosshair',
              touchAction: 'none',
            }}
          />

          {/* Loading overlay */}
          {loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '24px',
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                border: '2.5px solid rgba(248,185,76,0.3)',
                borderTop: '2.5px solid #F8B94C',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          )}
        </motion.div>

        {/* Подсказка */}
        <div style={{
          textAlign: 'center',
          padding: '8px 0 4px',
          fontFamily: "'Poppins', sans-serif",
          fontSize: '11px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.2)',
        }}>
          Рисуйте поверх превью — оно показывает расположение элементов профиля
        </div>

        {/* Подтверждение очистки */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                overflow: 'hidden',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '14px',
                padding: '10px 14px',
                margin: '4px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle style={{ width: '15px', height: '15px', color: '#EF4444', flexShrink: 0 }} />
                <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500, fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                  Стереть всё?
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '5px 12px',
                    cursor: 'pointer',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >Нет</button>
                <button
                  onClick={clearCanvas}
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '10px',
                    padding: '5px 12px',
                    cursor: 'pointer',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '11px',
                    color: '#EF4444',
                  }}
                >Да, стереть</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── ТУЛБАР ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.25 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '10px 4px',
            marginTop: 'auto',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          }}
        >
          {/* Строка 1: Pen / Eraser + Undo/Redo + Clear */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => {
                  setTool('pen');
                  if (!PEN_SIZES.includes(size)) setSize(DEFAULT_PEN_SIZE);
                  if (hapticFeedback) hapticFeedback('impact', 'light');
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '7px 14px', borderRadius: '12px', cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif", fontWeight: 500, fontSize: '12px',
                  transition: 'all 0.15s ease',
                  background: tool === 'pen' ? 'rgba(248,185,76,0.15)' : 'rgba(255,255,255,0.04)',
                  border: tool === 'pen' ? '1px solid rgba(248,185,76,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: tool === 'pen' ? '#F8B94C' : 'rgba(255,255,255,0.4)',
                }}
              >
                <Pen style={{ width: '13px', height: '13px' }} />
                Кисть
              </button>
              <button
                onClick={() => {
                  setTool('eraser');
                  if (!ERASER_SIZES.includes(size)) setSize(DEFAULT_ERASER_SIZE);
                  if (hapticFeedback) hapticFeedback('impact', 'light');
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '7px 14px', borderRadius: '12px', cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif", fontWeight: 500, fontSize: '12px',
                  transition: 'all 0.15s ease',
                  background: tool === 'eraser' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                  border: tool === 'eraser' ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: tool === 'eraser' ? '#A855F7' : 'rgba(255,255,255,0.4)',
                }}
              >
                <Eraser style={{ width: '13px', height: '13px' }} />
                Ластик
              </button>
            </div>

            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={undo} disabled={!canUndo} style={{
                background: canUndo ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', padding: '6px 8px', cursor: canUndo ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', opacity: canUndo ? 1 : 0.3,
              }}>
                <Undo2 style={{ width: '14px', height: '14px', color: '#F4F3FC' }} />
              </button>
              <button onClick={redo} disabled={!canRedo} style={{
                background: canRedo ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', padding: '6px 8px', cursor: canRedo ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', opacity: canRedo ? 1 : 0.3,
              }}>
                <Redo2 style={{ width: '14px', height: '14px', color: '#F4F3FC' }} />
              </button>
              <button
                onClick={() => hasContent ? setShowClearConfirm(true) : clearCanvas()}
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '10px', padding: '6px 8px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <Trash2 style={{ width: '14px', height: '14px', color: '#EF4444' }} />
              </button>
            </div>
          </div>

          {/* Строка 2: Палитра / Размер */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            {tool === 'pen' ? (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); if (hapticFeedback) hapticFeedback('impact', 'light'); }}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%', backgroundColor: c,
                      border: color === c ? '2.5px solid #FFFFFF' : '2px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                      transform: color === c ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: color === c ? `0 0 10px ${c}40` : 'none',
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            ) : (
              <span style={{
                fontFamily: "'Poppins', sans-serif", fontWeight: 500, fontSize: '12px',
                color: 'rgba(255,255,255,0.3)', flex: 1,
              }}>
                Размер ластика →
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {(tool === 'pen' ? PEN_SIZES : ERASER_SIZES).map((s) => (
                <button
                  key={s}
                  onClick={() => { setSize(s); if (hapticFeedback) hapticFeedback('impact', 'light'); }}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: size === s
                      ? (tool === 'pen' ? 'rgba(248,185,76,0.15)' : 'rgba(168,85,247,0.15)')
                      : 'rgba(255,255,255,0.04)',
                    border: size === s
                      ? (tool === 'pen' ? '1px solid rgba(248,185,76,0.4)' : '1px solid rgba(168,85,247,0.4)')
                      : '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{
                    width: `${Math.min(s + 2, 16)}px`, height: `${Math.min(s + 2, 16)}px`, borderRadius: '50%',
                    backgroundColor: size === s
                      ? (tool === 'pen' ? '#F8B94C' : '#A855F7')
                      : 'rgba(255,255,255,0.3)',
                  }} />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default GraffitiEditor;
