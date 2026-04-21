import React from 'react';

export const TopGlow = () => {
  return (
    <div 
      className="absolute pointer-events-none"
      style={{ 
        top: '0',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 0,
        width: '120%',
        height: '81px',
        overflow: 'visible'
      }}
    >
      {/* CSS gradient simulation of the three circles */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, rgba(163, 247, 191, 0.6) 0%, rgba(196, 163, 255, 0.6) 50%, rgba(255, 180, 209, 0.6) 100%)',
          filter: 'blur(90px)',
          mixBlendMode: 'lighten'
        }}
      />
    </div>
  );
};
