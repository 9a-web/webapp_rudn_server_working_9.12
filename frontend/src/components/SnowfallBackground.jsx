import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const SnowfallBackground = () => {
  const [snowflakes, setSnowflakes] = useState([]);

  useEffect(() => {
    // Generate a fixed number of snowflakes on mount
    const count = 30;
    const newSnowflakes = Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100, // Random horizontal position %
      delay: Math.random() * 5, // Random animation delay
      duration: 10 + Math.random() * 10, // Random fall duration (10-20s)
      size: 5 + Math.random() * 10, // Random size
    }));
    setSnowflakes(newSnowflakes);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {snowflakes.map((flake) => (
        <motion.div
          key={flake.id}
          initial={{
            y: -20,
            x: `${flake.left}vw`,
            opacity: 0,
          }}
          animate={{
            y: '100vh',
            x: [`${flake.left}vw`, `${flake.left + (Math.random() * 10 - 5)}vw`], // Slight drift
            opacity: [0, 0.7, 0],
          }}
          transition={{
            duration: flake.duration,
            repeat: Infinity,
            delay: flake.delay,
            ease: "linear",
          }}
          style={{
            position: 'absolute',
            width: flake.size,
            height: flake.size,
            borderRadius: '50%',
            backgroundColor: 'white',
            filter: 'blur(1px)',
            boxShadow: '0 0 5px rgba(255, 255, 255, 0.8)'
          }}
        />
      ))}
    </div>
  );
};

export default SnowfallBackground;
