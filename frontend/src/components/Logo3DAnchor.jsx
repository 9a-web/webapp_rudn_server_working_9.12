/**
 * 🎯 Logo3DAnchor — placeholder для глобального 3D-логотипа.
 *
 * Используется в местах, где раньше стоял <Logo3D />. Занимает место
 * указанного размера и регистрирует себя в Logo3DContext. Logo3DHost
 * увидит anchor и позиционирует свой Canvas над ним (position: fixed).
 *
 * При размонтировании anchor'а — Logo3DHost скрывает Canvas (но НЕ
 * размонтирует). Следующий маунт Logo3DAnchor → Host плавно летит обратно.
 *
 * Props — совпадают с <Logo3D />. При их изменении Logo3DHost перерендерит
 * внутренний Logo3D с новыми параметрами (без пересборки геометрии, если
 * не поменялся `smoothness` или `svg`).
 */

import React, { useEffect, useId, useMemo, useRef } from 'react';
import { useLogo3DContext } from '../contexts/Logo3DContext';

export default function Logo3DAnchor({
  size = 200,
  material = 'metal',
  animate = 'spin',
  animateSpeed = 2,
  smoothness = 0.2,
  metalness = 0.9,
  roughness = 0.25,
  color,
  lightPosition = [-0.5, 2, 4],
  priority = 0,
  className,
  style,
}) {
  const ref = useRef(null);
  const id = useId();
  const ctx = useLogo3DContext();

  // Стабильные props объект — для диффа
  const propsObject = useMemo(
    () => ({
      size,
      material,
      animate,
      animateSpeed,
      smoothness,
      metalness,
      roughness,
      color,
      lightPosition,
    }),
    [size, material, animate, animateSpeed, smoothness, metalness, roughness, color, lightPosition]
  );

  // Регистрация / снятие регистрации
  useEffect(() => {
    if (!ctx) return undefined;
    ctx.registerAnchor(id, ref, propsObject, priority);
    return () => ctx.unregisterAnchor(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, priority]);

  // Обновление props — separate effect, чтобы не дёргать register/unregister
  useEffect(() => {
    if (!ctx) return;
    ctx.updateAnchorProps(id, propsObject);
  }, [ctx, id, propsObject]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: size,
        height: size,
        position: 'relative',
        pointerEvents: 'none',
        ...style,
      }}
      aria-label="3D-логотип РУДН"
    />
  );
}
