/**
 * Утилиты и варианты анимаций для Framer Motion
 */

// Базовая анимация появления снизу вверх
export const fadeInUp = {
  initial: { 
    opacity: 0, 
    y: 20 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  exit: { 
    opacity: 0, 
    y: 20,
    transition: {
      duration: 0.3
    }
  }
};

// Анимация появления с масштабированием
export const fadeInScale = {
  initial: { 
    opacity: 0, 
    scale: 0.95 
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: {
      duration: 0.2
    }
  }
};

// Анимация модального окна
export const modalVariants = {
  initial: { 
    opacity: 0,
    scale: 0.9,
    y: 20
  },
  animate: { 
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  exit: { 
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: {
      duration: 0.2
    }
  }
};

// Анимация фона модального окна
export const backdropVariants = {
  initial: { 
    opacity: 0 
  },
  animate: { 
    opacity: 1,
    transition: {
      duration: 0.3
    }
  },
  exit: { 
    opacity: 0,
    transition: {
      duration: 0.2
    }
  }
};

// Анимация для списков (с задержкой между элементами)
export const listItemVariants = {
  initial: { 
    opacity: 0, 
    x: -20 
  },
  animate: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }),
  exit: { 
    opacity: 0, 
    x: -20,
    transition: {
      duration: 0.2
    }
  }
};

// Контейнер для staggered анимации детей
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

// Анимация карточки (раскрытие/сворачивание)
export const cardExpandVariants = {
  collapsed: { 
    height: 'auto',
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  expanded: { 
    height: 'auto',
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

// Анимация появления справа налево (для календаря)
export const slideInRight = {
  initial: { 
    x: '100%',
    opacity: 0
  },
  animate: { 
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 200
    }
  },
  exit: { 
    x: '100%',
    opacity: 0,
    transition: {
      duration: 0.2
    }
  }
};

// Анимация для кнопок (hover и tap)
export const buttonVariants = {
  hover: { 
    scale: 1.05,
    transition: {
      duration: 0.2,
      ease: 'easeInOut'
    }
  },
  tap: { 
    scale: 0.95,
    transition: {
      duration: 0.1
    }
  }
};

// Мягкий bounce эффект для кнопок (деликатный)
export const softBounceVariants = {
  hover: { 
    scale: 1.02,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 17
    }
  },
  tap: { 
    scale: 0.98,
    transition: {
      type: 'spring',
      stiffness: 600,
      damping: 20
    }
  }
};

// Spring анимация для интерактивных элементов
export const springVariants = {
  hover: {
    scale: 1.03,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 15
    }
  },
  tap: {
    scale: 0.97,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 25
    }
  }
};

// Деликатная анимация для карточек
export const cardSpringVariants = {
  hover: {
    y: -2,
    scale: 1.01,
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 20
    }
  },
  tap: {
    scale: 0.99,
    transition: {
      type: 'spring',
      stiffness: 600,
      damping: 25
    }
  }
};

// Анимация пульсации (для загрузки)
export const pulseVariants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};

// Анимация вращения (для загрузки)
export const spinVariants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear'
    }
  }
};

// Анимация для header элементов
export const headerItemVariants = {
  initial: { 
    opacity: 0, 
    y: -20 
  },
  animate: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1]
    }
  })
};

// Анимация для day selector
export const daySelectorVariants = {
  initial: { 
    opacity: 0,
    scale: 0.8
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  tap: {
    scale: 0.95,
    transition: {
      duration: 0.1
    }
  }
};

// Анимация переключения между состояниями (для контента)
export const contentSwitchVariants = {
  initial: { 
    opacity: 0,
    x: -20
  },
  animate: { 
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  exit: { 
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.2
    }
  }
};

// Анимация для Live Schedule Card
export const liveCardVariants = {
  initial: { 
    opacity: 0,
    scale: 0.9,
    y: -10
  },
  animate: { 
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

// Улучшенные page transitions (мягкие)
export const pageTransitionVariants = {
  initial: {
    opacity: 0,
    scale: 0.98,
    y: 10
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -10,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

// Мягкий swipe indicator
export const swipeIndicatorVariants = {
  initial: { opacity: 0, x: 0 },
  left: { 
    opacity: [0, 0.3, 0],
    x: [-10, 0, 10],
    transition: { duration: 0.4 }
  },
  right: { 
    opacity: [0, 0.3, 0],
    x: [10, 0, -10],
    transition: { duration: 0.4 }
  }
};

export default {
  fadeInUp,
  fadeInScale,
  modalVariants,
  backdropVariants,
  listItemVariants,
  staggerContainer,
  cardExpandVariants,
  slideInRight,
  buttonVariants,
  softBounceVariants,
  springVariants,
  cardSpringVariants,
  pulseVariants,
  spinVariants,
  headerItemVariants,
  daySelectorVariants,
  contentSwitchVariants,
  liveCardVariants,
  pageTransitionVariants,
  swipeIndicatorVariants
};
