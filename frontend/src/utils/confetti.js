import confetti from 'canvas-confetti';

/**
 * Конфетти для достижений (Новогодняя версия 🎄)
 * Снежинки (белый/голубой) + Мандарины (оранжевый) + Золото
 */
export const celebrateAchievement = () => {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
  
  // Winter & Mandarin Palette
  // #FFFFFF (Snow), #A5F3FC (Ice), #FB923C (Mandarin), #FFD700 (Gold)
  const winterColors = ['#FFFFFF', '#A5F3FC', '#FB923C', '#FFD700'];

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    
    // Конфетти слева
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: winterColors,
      shapes: ['circle', 'square', 'star'], // Звезды для праздника
      scalar: 1.2 // Чуть крупнее
    });
    
    // Конфетти справа
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: winterColors,
      shapes: ['circle', 'square', 'star'],
      scalar: 1.2
    });
  }, 250);
};

/**
 * Взрыв конфетти из центра
 */
export const confettiExplosion = () => {
  const count = 200;
  const defaults = {
    origin: { y: 0.5 },
    zIndex: 9999,
    colors: ['#FFFFFF', '#7DD3FC', '#FDBA74', '#FDE047'] // Светлее
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    shapes: ['star']
  });
  
  fire(0.2, {
    spread: 60,
  });
  
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  });
  
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    shapes: ['star']
  });
  
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
};

/**
 * Фейерверк конфетти
 */
export const confettiFireworks = () => {
  const duration = 5000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.9), y: randomInRange(0.1, 0.5) },
      colors: ['#FFFFFF', '#38BDF8', '#FB923C', '#F472B6', '#C084FC'],
      shapes: ['star', 'circle']
    });
  }, 250);
};

/**
 * Радужное конфетти (для пасхалки) - Элегантное северное сияние
 */
export const rainbowConfetti = () => {
  const duration = 4000;
  const animationEnd = Date.now() + duration;
  
  // Elegant aurora colors - мягкие переливающиеся цвета
  const auroraColors = [
    '#67E8F9', // cyan
    '#A78BFA', // violet  
    '#F472B6', // pink
    '#34D399', // emerald
    '#FBBF24', // amber
    '#FFFFFF'  // white sparkle
  ];

  // Начальный взрыв из центра
  confetti({
    particleCount: 80,
    spread: 100,
    origin: { x: 0.5, y: 0.4 },
    colors: auroraColors,
    zIndex: 9999,
    shapes: ['circle', 'star'],
    scalar: 1.1,
    startVelocity: 40,
    gravity: 0.8,
    ticks: 200
  });

  // Плавные волны конфетти с обеих сторон
  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    
    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const progress = timeLeft / duration;
    const particleCount = Math.floor(4 * progress);

    // Левая сторона
    confetti({
      particleCount,
      angle: 60,
      spread: 45,
      origin: { x: 0, y: 0.5 },
      colors: auroraColors,
      zIndex: 9999,
      shapes: ['circle'],
      scalar: 0.9,
      gravity: 0.6,
      drift: 1,
      ticks: 150
    });
    
    // Правая сторона
    confetti({
      particleCount,
      angle: 120,
      spread: 45,
      origin: { x: 1, y: 0.5 },
      colors: auroraColors,
      zIndex: 9999,
      shapes: ['circle'],
      scalar: 0.9,
      gravity: 0.6,
      drift: -1,
      ticks: 150
    });
  }, 100);
};

/**
 * Простое конфетти для быстрых достижений
 */
export const quickConfetti = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#FFFFFF', '#BAE6FD', '#FDBA74'],
    zIndex: 9999,
    shapes: ['circle', 'square'],
    scalar: 0.9
  });
};

/**
 * Небольшое конфетти для завершения всех задач
 * Используется когда пользователь выполнил все задачи за день
 */
export const tasksCompleteConfetti = () => {
  const count = 80;
  const defaults = {
    origin: { y: 0.4 },
    zIndex: 9999,
    colors: ['#FCD34D', '#FBBF24', '#F59E0B', '#FFFFFF', '#E0F2FE'] // Золото + Снег
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  // Первая волна - узкая
  fire(0.3, {
    spread: 40,
    startVelocity: 45,
    decay: 0.9,
    shapes: ['star']
  });
  
  // Вторая волна - широкая
  fire(0.4, {
    spread: 80,
    startVelocity: 30,
    decay: 0.92
  });
  
  // Третья волна - медленная
  fire(0.3, {
    spread: 100,
    startVelocity: 20,
    decay: 0.95,
    scalar: 0.8
  });
};
