import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Инициализируем тему из localStorage или 'default'
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('app_theme');
      return savedTheme || 'default';
    } catch (error) {
      console.error('Error reading theme from localStorage:', error);
      return 'default';
    }
  });

  // При изменении темы сохраняем её
  useEffect(() => {
    try {
      localStorage.setItem('app_theme', theme);
    } catch (error) {
      console.error('Error saving theme to localStorage:', error);
    }
  }, [theme]);

  const value = {
    theme,
    setTheme,
    isWinter: theme === 'winter'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
