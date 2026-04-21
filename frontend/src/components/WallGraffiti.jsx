import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pen, Eraser, Undo2, Redo2, Trash2, AlertTriangle,
  Check, X, Users, Lock, Unlock, Palette,
} from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';

/* ────────────────────────────────────────────────
   Стена граффити — отображается в табе «Общее».
   Владелец всегда может рисовать.
   Гости — только если wall_graffiti_access = true.
   ──────────────────────────────────────────────── */

const WALL_W = 500;
const WALL_H = 400;

const PEN_SIZES    = [2, 4, 8, 14];
const ERASER_SIZES = [8, 14, 22, 32];
const DEFAULT_PEN    = 4;
const DEFAULT_ERASER = 14;
const COLORS = ['#F8B94C', '#EF4444', '#3B82F6', '#10B981', '#A855F7', '#EC4899', '#FFFFFF', '#6B7280'];
const MAX_HISTORY = 30;

const formatWallUpdatedAt = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'только что';
    if (diffMin < 60) return `${diffMin} мин назад`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} ч назад`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} дн назад`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  } catch { return ''; }
};

const WallGraffiti = ({ user, profileOwnerId, hapticFeedback }) => {
  const isOwner = String(user?.id) === String(profileOwnerId);

  // === Data state ===
  const [wallData, setWallData]         = useState(null);   // base64 data URL | null
  const [accessEnabled, setAccessEnabled] = useState(false);
  const [dataLoading, setDataLoading]   = useState(true);

  // === Editor state ===
  const [editing, setEditing]           = useState(false);
  const [tool, setTool]                 = useState('pen');
  const [color, setColor]               = useState('#F8B94C');
  const [size, setSize]                 = useState(DEFAULT_PEN);
  const [canUndo, setCanUndo]           = useState(false);
  const [canRedo, setCanRedo]           = useState(false);
  const [hasContent, setHasContent]     = useState(false);
  const [saveStatus, setSaveStatus]     = useState('idle');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [accessToggling, setAccessToggling] = useState(false);

  // === Canvas refs ===
  const canvasRef    = useRef(null);
  const ctxRef       = useRef(null);
  const drawing      = useRef(false);
  const lastPt       = useRef(null);
  const colorRef     = useRef('#F8B94C');
  const sizeRef      = useRef(DEFAULT_PEN);
  const toolRef      = useRef('pen');
  const dirty        = useRef(false);
  const savingLock   = useRef(false);
  const clearingRef  = useRef(false);
  const history      = useRef([]);
  const historyIdx   = useRef(-1);
  const saveSnapshotRef = useRef(null);

  // Sync state → refs
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current  = size;  }, [size]);
  useEffect(() => { toolRef.current  = tool;  }, [tool]);

  // === Helpers ===
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

  useEffect(() => { saveSnapshotRef.current = saveSnapshot; }, [saveSnapshot]);

  const setupCanvas = useCallback((canvas, skipSnapshot) => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const tW  = WALL_W * dpr;
    const tH  = WALL_H * dpr;
    if (canvas.width === tW && canvas.height === tH && ctxRef.current) return;
    canvas.width  = tW;
    canvas.height = tH;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;
    if (!skipSnapshot && saveSnapshotRef.current) saveSnapshotRef.current();
  }, []);

  const getXY = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let cx, cy;
    if (e.touches?.length > 0)             { cx = e.touches[0].clientX;        cy = e.touches[0].clientY; }
    else if (e.changedTouches?.length > 0)  { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
    else                                    { cx = e.clientX;                   cy = e.clientY; }
    return {
      x: (cx - rect.left) * (WALL_W / rect.width),
      y: (cy - rect.top)  * (WALL_H / rect.height),
    };
  }, []);

  // === Fetch wall graffiti ===
  const [lastDrawnBy, setLastDrawnBy] = useState(null);   // telegram_id
  const [lastDrawnName, setLastDrawnName] = useState(null);
  const [lastDrawnAt, setLastDrawnAt] = useState(null);
  const fetchAbortRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!profileOwnerId) return;

    // Cancel previous fetch if in flight
    if (fetchAbortRef.current) fetchAbortRef.current.aborted = true;
    const token = { aborted: false };
    fetchAbortRef.current = token;

    setDataLoading(true);
    try {
      const res = await friendsAPI.getWallGraffiti(profileOwnerId, user?.id);
      if (token.aborted) return;
      // Валидация data-URL: принимаем только whitelist форматы
      const data = res?.wall_graffiti_data || '';
      const isValidDataUrl = data && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(data);
      setWallData(isValidDataUrl ? data : null);
      setAccessEnabled(!!res?.wall_graffiti_access);
      setLastDrawnBy(res?.wall_graffiti_last_drawn_by || null);
      setLastDrawnName(res?.wall_graffiti_last_drawn_name || null);
      setLastDrawnAt(res?.wall_graffiti_updated_at || null);
    } catch (err) {
      if (!token.aborted) console.error('[WallGraffiti] Fetch error:', err);
    } finally {
      if (!token.aborted) setDataLoading(false);
    }
  }, [profileOwnerId, user?.id]);

  useEffect(() => {
    fetchData();
    return () => {
      if (fetchAbortRef.current) fetchAbortRef.current.aborted = true;
    };
  }, [fetchData]);

  // === Toggle access ===
  const toggleAccess = useCallback(async () => {
    if (!isOwner || accessToggling) return;
    setAccessToggling(true);
    try {
      const res = await friendsAPI.toggleWallGraffitiAccess(user.id);
      setAccessEnabled(!!res?.wall_graffiti_access);
      if (hapticFeedback) hapticFeedback('notification', 'success');
    } catch (err) {
      console.error('[WallGraffiti] Toggle access error:', err);
    } finally {
      setAccessToggling(false);
    }
  }, [isOwner, user?.id, hapticFeedback, accessToggling]);

  // === Can the current user draw? ===
  const canDraw = isOwner || accessEnabled;

  // === Drawing into existing image ===
  const drawImageToCanvas = useCallback((dataUrl) => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const ctx    = ctxRef.current;
      if (!canvas || !ctx || !dataUrl) { resolve(false); return; }
      const img = new window.Image();
      img.onload = () => {
        const iW = img.naturalWidth, iH = img.naturalHeight;
        if (iW > 0 && iH > 0) {
          const iA = iW / iH, cA = WALL_W / WALL_H;
          let dW, dH, dX, dY;
          if (Math.abs(iA - cA) < 0.05) { dW = WALL_W; dH = WALL_H; dX = 0; dY = 0; }
          else if (iA > cA) { dW = WALL_W; dH = WALL_W / iA; dX = 0; dY = (WALL_H - dH) / 2; }
          else               { dH = WALL_H; dW = WALL_H * iA; dX = (WALL_W - dW) / 2; dY = 0; }
          ctx.drawImage(img, dX, dY, dW, dH);
        } else {
          ctx.drawImage(img, 0, 0, WALL_W, WALL_H);
        }
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = dataUrl;
    });
  }, []);

  // === Start editing ===
  const startEditing = useCallback(async () => {
    setEditing(true);
    dirty.current      = false;
    clearingRef.current = false;
    history.current    = [];
    historyIdx.current = -1;
    setCanUndo(false);
    setCanRedo(false);
    setSaveStatus('idle');
    setShowClearConfirm(false);
    setTool('pen');
    setColor('#F8B94C');
    setSize(DEFAULT_PEN);

    // Инициализируем canvas через rAF, чтобы DOM обновился
    requestAnimationFrame(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setupCanvas(canvas, true);
      if (wallData) {
        await drawImageToCanvas(wallData);
        saveSnapshot();
        dirty.current = false;
        setHasContent(true);
      } else {
        saveSnapshot();
        dirty.current = false;
      }
    });
  }, [wallData, setupCanvas, drawImageToCanvas, saveSnapshot]);

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
    clearingRef.current = true;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, WALL_W, WALL_H);
    history.current    = [];
    historyIdx.current = -1;
    setCanUndo(false);
    setCanRedo(false);
    saveSnapshot();
    dirty.current = false;
    setHasContent(false);
    setShowClearConfirm(false);
    if (hapticFeedback) hapticFeedback('notification', 'success');
    if (isOwner && user?.id) {
      try {
        await friendsAPI.clearWallGraffiti(user.id);
        setWallData(null);
      } catch (err) {
        console.error('[WallGraffiti] Clear error:', err);
      }
    }
    clearingRef.current = false;
  }, [saveSnapshot, hapticFeedback, isOwner, user?.id]);

  // === Save ===
  const saveToServer = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !user?.id || !dirty.current || savingLock.current || clearingRef.current) return;
    savingLock.current = true;
    setSaveStatus('saving');
    try {
      const NORM_W = WALL_W * 2;
      const NORM_H = WALL_H * 2;
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

      await friendsAPI.saveWallGraffiti(profileOwnerId, user.id, url);
      dirty.current = false;
      setWallData(url);
      // Обновляем метаданные последнего рисования локально
      setLastDrawnBy(user.id);
      setLastDrawnName(null);  // Фронт не знает имя сам — refetch не обязателен
      setLastDrawnAt(new Date().toISOString());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('[WallGraffiti] Save error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      savingLock.current = false;
    }
  }, [user?.id, profileOwnerId]);

  // === Done editing ===
  const handleDone = useCallback(async () => {
    if (dirty.current && !clearingRef.current) await saveToServer();
    setEditing(false);
    if (hapticFeedback) hapticFeedback('impact', 'light');
    // Reset canvas state
    history.current    = [];
    historyIdx.current = -1;
    ctxRef.current     = null;
    dirty.current      = false;
    savingLock.current  = false;
  }, [saveToServer, hapticFeedback]);

  // === Cancel editing ===
  const handleCancel = useCallback(() => {
    setEditing(false);
    history.current    = [];
    historyIdx.current = -1;
    ctxRef.current     = null;
    dirty.current      = false;
    savingLock.current  = false;
    clearingRef.current = false;
    if (hapticFeedback) hapticFeedback('impact', 'light');
  }, [hapticFeedback]);

  // === Canvas listeners (only while editing) ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !editing) return;

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
  }, [editing, setupCanvas, saveSnapshot, getXY]);

  // ──────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────

  // Loading state
  if (dataLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 0',
        gap: '12px',
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          border: '2.5px solid rgba(248,185,76,0.2)',
          borderTop: '2.5px solid #F8B94C',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 500,
          fontSize: '12px',
          color: 'rgba(255,255,255,0.25)',
        }}>
          Загрузка стены граффити...
        </span>
      </div>
    );
  }

  // === Display mode (not editing) ===
  if (!editing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}
      >
        {/* Заголовок секции */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Palette style={{ width: '16px', height: '16px', color: '#F8B94C' }} />
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize: '15px',
              color: '#F4F3FC',
            }}>
              Стена граффити
            </span>
          </div>

          {/* Access toggle — только для владельца */}
          {isOwner && (
            <button
              onClick={toggleAccess}
              disabled={accessToggling}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '10px',
                background: accessEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                border: accessEnabled ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
                cursor: accessToggling ? 'default' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: accessToggling ? 0.5 : 1,
              }}
            >
              {accessEnabled
                ? <Unlock style={{ width: '13px', height: '13px', color: '#10B981' }} />
                : <Lock style={{ width: '13px', height: '13px', color: 'rgba(255,255,255,0.35)' }} />
              }
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: '11px',
                color: accessEnabled ? '#10B981' : 'rgba(255,255,255,0.35)',
              }}>
                {accessEnabled ? 'Гостям открыто' : 'Гостям закрыто'}
              </span>
            </button>
          )}
        </div>

        {/* Превью стены */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: `${WALL_W} / ${WALL_H}`,
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1.5px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          {wallData ? (
            <>
              <img
                src={wallData}
                alt="Wall graffiti"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              {/* Footer с автором граффити */}
              {(lastDrawnName || lastDrawnAt) && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: '10px 14px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  pointerEvents: 'none',
                }}>
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.85)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    maxWidth: '60%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {lastDrawnName && lastDrawnBy === user?.id
                      ? 'Вы нарисовали'
                      : lastDrawnName
                        ? `Нарисовал(а) ${lastDrawnName}`
                        : null}
                  </span>
                  {lastDrawnAt && (
                    <span style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 500,
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.6)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    }}>
                      {formatWallUpdatedAt(lastDrawnAt)}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}>
              <Palette style={{ width: '36px', height: '36px', color: 'rgba(255,255,255,0.06)' }} />
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: '13px',
                color: 'rgba(255,255,255,0.15)',
                textAlign: 'center',
                padding: '0 20px',
              }}>
                {isOwner
                  ? 'Нарисуйте что-нибудь на стене!'
                  : accessEnabled
                    ? 'Стена пуста — будьте первым!'
                    : 'Стена пуста'
                }
              </span>
            </div>
          )}

          {/* Overlay кнопка «Рисовать» */}
          {canDraw && (
            <button
              onClick={() => { startEditing(); if (hapticFeedback) hapticFeedback('impact', 'medium'); }}
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '14px',
                background: 'rgba(248,185,76,0.2)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(248,185,76,0.35)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Pen style={{ width: '14px', height: '14px', color: '#F8B94C' }} />
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '13px',
                color: '#F8B94C',
              }}>
                Рисовать
              </span>
            </button>
          )}

          {/* Бейдж для гостей без доступа */}
          {!isOwner && !accessEnabled && (
            <div style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <Lock style={{ width: '12px', height: '12px', color: 'rgba(255,255,255,0.2)' }} />
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: '11px',
                color: 'rgba(255,255,255,0.2)',
              }}>
                Рисование закрыто
              </span>
            </div>
          )}
        </div>

        {/* Подсказка */}
        {isOwner && (
          <div style={{
            textAlign: 'center',
            fontFamily: "'Poppins', sans-serif",
            fontSize: '11px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.15)',
            padding: '0 8px',
          }}>
            {accessEnabled
              ? 'Друзья и гости могут рисовать на вашей стене'
              : 'Разрешите гостям рисовать, нажав на замок выше'}
          </div>
        )}
      </motion.div>
    );
  }

  // === Editing mode — inline canvas + toolbar ===
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}
    >
      {/* Заголовок редактора */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <button
          onClick={handleCancel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
          }}
        >
          <X style={{ width: '14px', height: '14px', color: 'rgba(255,255,255,0.5)' }} />
          <span style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500,
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
          }}>
            Отмена
          </span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Pen style={{ width: '13px', height: '13px', color: '#F8B94C' }} />
          <span style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize: '14px',
            color: '#F4F3FC',
          }}>
            Стена граффити
          </span>
          {saveStatus === 'saving' && (
            <span style={{ fontSize: '10px', color: 'rgba(248,185,76,0.7)', animation: 'pulse 1s infinite' }}>
              ...
            </span>
          )}
          {saveStatus === 'saved' && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: '11px', color: '#10B981' }}>
              ✓
            </motion.span>
          )}
          {saveStatus === 'error' && (
            <span style={{ fontSize: '10px', color: '#EF4444' }}>!</span>
          )}
        </div>

        <button
          onClick={handleDone}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 14px',
            borderRadius: '10px',
            background: 'rgba(248,185,76,0.15)',
            border: '1px solid rgba(248,185,76,0.35)',
            cursor: 'pointer',
          }}
        >
          <Check style={{ width: '14px', height: '14px', color: '#F8B94C' }} />
          <span style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize: '12px',
            color: '#F8B94C',
          }}>
            Готово
          </span>
        </button>
      </div>

      {/* Canvas */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${WALL_W} / ${WALL_H}`,
        borderRadius: '20px',
        overflow: 'hidden',
        border: '1.5px solid rgba(248,185,76,0.2)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
            touchAction: 'none',
          }}
        />
      </div>

      {/* Clear confirm */}
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
                  borderRadius: '10px', padding: '5px 12px', cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif", fontWeight: 500, fontSize: '11px',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >Нет</button>
              <button
                onClick={clearCanvas}
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '10px', padding: '5px 12px', cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif", fontWeight: 500, fontSize: '11px',
                  color: '#EF4444',
                }}
              >Да, стереть</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── ТУЛБАР ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Pen / Eraser + Undo/Redo + Clear */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => {
                setTool('pen');
                if (!PEN_SIZES.includes(size)) setSize(DEFAULT_PEN);
                if (hapticFeedback) hapticFeedback('impact', 'light');
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '7px 12px', borderRadius: '12px', cursor: 'pointer',
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
                if (!ERASER_SIZES.includes(size)) setSize(DEFAULT_ERASER);
                if (hapticFeedback) hapticFeedback('impact', 'light');
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '7px 12px', borderRadius: '12px', cursor: 'pointer',
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
            {isOwner && (
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
            )}
          </div>
        </div>

        {/* Палитра / Размер */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          {tool === 'pen' ? (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); if (hapticFeedback) hapticFeedback('impact', 'light'); }}
                  style={{
                    width: '26px', height: '26px', borderRadius: '50%', backgroundColor: c,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            {(tool === 'pen' ? PEN_SIZES : ERASER_SIZES).map((s) => (
              <button
                key={s}
                onClick={() => { setSize(s); if (hapticFeedback) hapticFeedback('impact', 'light'); }}
                style={{
                  width: '26px', height: '26px', borderRadius: '50%',
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
      </div>
    </motion.div>
  );
};

export default WallGraffiti;
