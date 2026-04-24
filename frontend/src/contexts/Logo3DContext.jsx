/**
 * 🎯 Logo3DContext — singleton-контекст для persistent 3D-логотипа.
 *
 * Архитектура:
 *   <Logo3DProvider>
 *     <Logo3DHost />              ← один инстанс Logo3D в Portal (body)
 *     <App>
 *       <LoadingScreen>
 *         <Logo3DAnchor size={200} />  ← placeholder div
 *       <AuthLayout>
 *         <Logo3DAnchor size={112} />
 *     </App>
 *   </Logo3DProvider>
 *
 * Logo3DHost следит за активным anchor'ом (самым последним / высокоприоритетным)
 * и позиционирует свой Canvas абсолютно над ним. При размонтировании
 * LoadingScreen и монтировании AuthLayout — Canvas НЕ пересоздаётся, а
 * плавно «перелетает» на новое место.
 *
 * Это экономит: HTTP-fetch SVG, парсинг, построение ExtrudeGeometry,
 * intro-анимацию камеры (2.5s) и монтирование WebGL-контекста.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const Logo3DContext = createContext(null);

export function Logo3DProvider({ children }) {
  // anchors: массив { id, ref, props, priority, registeredAt }
  const [anchors, setAnchors] = useState([]);
  // Счётчик регистраций — для tie-break при одинаковом priority
  const counterRef = useRef(0);

  // Активный anchor — с максимальным (priority, registeredAt).
  // При одинаковом priority побеждает последний зарегистрированный.
  const activeAnchor = useMemo(() => {
    if (anchors.length === 0) return null;
    return anchors.reduce((best, cur) => {
      if (!best) return cur;
      if (cur.priority > best.priority) return cur;
      if (cur.priority === best.priority && cur.registeredAt > best.registeredAt) return cur;
      return best;
    }, null);
  }, [anchors]);

  const registerAnchor = useCallback((id, ref, props, priority = 0) => {
    counterRef.current += 1;
    const registeredAt = counterRef.current;
    setAnchors((prev) => {
      const filtered = prev.filter((a) => a.id !== id);
      return [...filtered, { id, ref, props, priority, registeredAt }];
    });
  }, []);

  const unregisterAnchor = useCallback((id) => {
    setAnchors((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const updateAnchorProps = useCallback((id, newProps) => {
    setAnchors((prev) => prev.map((a) => (a.id === id ? { ...a, props: newProps } : a)));
  }, []);

  const value = useMemo(
    () => ({
      activeAnchor,
      registerAnchor,
      unregisterAnchor,
      updateAnchorProps,
    }),
    [activeAnchor, registerAnchor, unregisterAnchor, updateAnchorProps]
  );

  return <Logo3DContext.Provider value={value}>{children}</Logo3DContext.Provider>;
}

export function useLogo3DContext() {
  return useContext(Logo3DContext);
}

export default Logo3DContext;
