/**
 * 🎯 Logo3DHost — singleton-инстанс 3D-логотипа в DOM (Portal в body).
 *
 * Рендерится ОДИН раз при маунте Logo3DProvider и НЕ размонтируется до
 * перезагрузки страницы. Позиционируется абсолютно (`position: fixed`) над
 * активным Logo3DAnchor'ом.
 *
 * ## Что это решает:
 *
 * Пакет `3dsvg` (обёртка над three.js) при каждом маунте компонента:
 *  1. Делает `fetch(svgUrl)` — сетевой запрос (~50-200ms)
 *  2. Парсит SVG → THREE.ShapePath[]
 *  3. Строит `new THREE.ExtrudeGeometry()` (1448 сегментов) — ~300-800ms
 *  4. Создаёт WebGL Canvas + shaders
 *  5. Воспроизводит intro-анимацию "zoom" (2.5 секунды)
 *
 * Итого 500-3000ms "чёрного экрана" при каждом монтировании.
 *
 * ## Как работает позиционирование (без задержек):
 *
 *  - Continuous requestAnimationFrame loop, пока anchor смонтирован.
 *  - Позиция применяется через `transform: translate3d(...)` напрямую к DOM,
 *    БЕЗ React state и БЕЗ CSS transition. Это даёт 60fps без re-render и
 *    идеальное «приклеивание» к anchor'у при скролле/анимациях.
 *  - Когда anchor исчезает (страница меняется) — Canvas мгновенно прячется
 *    через `display: none`. Когда новый anchor появляется — Canvas мгновенно
 *    появляется на новом месте. Никаких «перелётов».
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLogo3DContext } from '../contexts/Logo3DContext';
import Logo3D from './Logo3D';
import {
  DEFAULT_LOGO_SVG_URL,
  getCachedLogoSvg,
  preloadLogoSvg,
} from '../utils/logoPreload';

const DEFAULT_LIGHT_POSITION = [-0.5, 2, 4];

export default function Logo3DHost() {
  const { activeAnchor } = useLogo3DContext();
  const [svgString, setSvgString] = useState(() => getCachedLogoSvg());

  // Ref на host-div: позиционируем напрямую через style, без React state.
  // Это убирает 60 ре-рендеров/сек на скролле и зависание Canvas.
  const hostRef = useRef(null);

  // Preload SVG если ещё не в кэше
  useEffect(() => {
    if (svgString) return;
    let cancelled = false;
    preloadLogoSvg(DEFAULT_LOGO_SVG_URL).then((s) => {
      if (!cancelled && s) setSvgString(s);
    });
    return () => {
      cancelled = true;
    };
  }, [svgString]);

  // Continuous RAF loop: следим за позицией anchor'а и применяем transform
  // напрямую к DOM. Никаких React-перерендеров.
  const anchorId = activeAnchor?.id;
  const anchorRef = activeAnchor?.ref;
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const el = anchorRef?.current;
    if (!el) {
      // Якорь отсутствует — мгновенно прячем Canvas (без transition).
      host.style.display = 'none';
      return undefined;
    }

    let rafHandle = 0;
    let prevLeft = NaN;
    let prevTop = NaN;
    let prevWidth = NaN;
    let prevHeight = NaN;

    const tick = () => {
      const r = el.getBoundingClientRect();
      // Если anchor скрыт (display:none) — getBoundingClientRect вернёт 0×0.
      if (r.width === 0 && r.height === 0) {
        host.style.display = 'none';
      } else {
        // Применяем стили только если изменились (минимизируем layout/paint).
        if (host.style.display !== 'block') host.style.display = 'block';
        if (r.left !== prevLeft || r.top !== prevTop) {
          host.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
          prevLeft = r.left;
          prevTop = r.top;
        }
        if (r.width !== prevWidth) {
          host.style.width = `${r.width}px`;
          prevWidth = r.width;
        }
        if (r.height !== prevHeight) {
          host.style.height = `${r.height}px`;
          prevHeight = r.height;
        }
      }
      rafHandle = requestAnimationFrame(tick);
    };

    rafHandle = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafHandle);
      // На время "перехода" между anchor'ами (старый размонтировался,
      // новый ещё не появился) — прячем Canvas, чтобы он не "висел" на
      // месте старого. Если новый anchor появится — следующий useEffect
      // run его подхватит.
      if (host) host.style.display = 'none';
    };
  }, [anchorId, anchorRef]);

  const props = activeAnchor?.props ?? {};
  const size = props.size ?? 200;

  // SSR guard
  if (typeof document === 'undefined') return null;

  // Базовый стиль host-div'а. Позиция/размер применяются императивно через
  // hostRef (см. useEffect выше) — это даёт 60fps без React-ре-рендеров.
  const baseStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: size,
    height: size,
    pointerEvents: 'none',
    zIndex: 100,
    display: 'none', // изначально скрыт — RAF включит когда anchor появится
    willChange: 'transform',
  };

  return createPortal(
    <div ref={hostRef} style={baseStyle} aria-hidden="true" data-testid="logo3d-host">
      <Logo3D
        size={size}
        material={props.material ?? 'metal'}
        animate={props.animate ?? 'spin'}
        animateSpeed={props.animateSpeed ?? 2}
        smoothness={props.smoothness ?? 0.2}
        metalness={props.metalness ?? 0.9}
        roughness={props.roughness ?? 0.25}
        color={props.color}
        lightPosition={props.lightPosition ?? DEFAULT_LIGHT_POSITION}
        svgString={svgString || undefined}
        svg={svgString ? undefined : DEFAULT_LOGO_SVG_URL}
        fallbackSrc={DEFAULT_LOGO_SVG_URL}
      />
    </div>,
    document.body
  );
}
