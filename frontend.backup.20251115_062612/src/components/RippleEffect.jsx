import React from 'react';
import { motion } from 'framer-motion';

/**
 * Компонент для отображения ripple эффектов
 * Используется вместе с useRipple hook
 */
export const RippleEffect = ({ ripples }) => {
  return (
    <>
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
          }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ 
            scale: 1, 
            opacity: 0,
          }}
          transition={{ 
            duration: 0.6,
            ease: [0.25, 0.1, 0.25, 1]
          }}
        />
      ))}
    </>
  );
};

export default RippleEffect;
