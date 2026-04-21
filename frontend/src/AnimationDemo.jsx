import React, { useState } from 'react';
import { LiveScheduleCard } from './components/LiveScheduleCard';
import './index.css';

// Демо страница для тестирования анимаций Live Schedule Card
function AnimationDemo() {
  const [hasClass, setHasClass] = useState(true);
  const [minutesLeft, setMinutesLeft] = useState(45);

  const handleToggleClass = () => {
    setHasClass(!hasClass);
  };

  const handleChangeMinutes = (e) => {
    setMinutesLeft(parseInt(e.target.value));
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#1A1A1A',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '20px',
        backgroundColor: '#2A2A2A',
        borderRadius: '12px',
        marginBottom: '20px'
      }}>
        <h1 style={{ color: '#FFFFFF', marginBottom: '20px' }}>
          🎨 Демо анимаций Live Schedule Card
        </h1>
        
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={handleToggleClass}
            style={{
              padding: '12px 24px',
              backgroundColor: hasClass ? '#A3F7BF' : '#FFB4D1',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            {hasClass ? '✅ Есть пара' : '❌ Нет пары'}
          </button>
          
          <span style={{ color: '#999999', marginLeft: '10px' }}>
            Переключить состояние
          </span>
        </div>

        {hasClass && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#FFFFFF', display: 'block', marginBottom: '8px' }}>
              ⏱️ Осталось минут: {minutesLeft}
            </label>
            <input
              type="range"
              min="1"
              max="90"
              value={minutesLeft}
              onChange={handleChangeMinutes}
              style={{
                width: '100%',
                accentColor: '#A3F7BF'
              }}
            />
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              color: '#666666',
              fontSize: '12px',
              marginTop: '4px'
            }}>
              <span>1 мин</span>
              <span>Прогресс: {Math.round((90 - minutesLeft) / 90 * 100)}%</span>
              <span>90 мин</span>
            </div>
          </div>
        )}

        <div style={{
          padding: '16px',
          backgroundColor: '#1A1A1A',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: '#A3F7BF', marginBottom: '12px' }}>
            ✨ Активные анимации:
          </h3>
          <ul style={{ color: '#CCCCCC', lineHeight: '1.8' }}>
            <li>🌊 Дыхание круга (scale pulse)</li>
            <li>💫 Пульсирующее свечение</li>
            <li>📊 Progress bar {hasClass ? '(активен)' : '(неактивен)'}</li>
            <li>⏰ Плавная смена времени</li>
            <li>🎭 Параллакс фоновых слоев</li>
            <li>✨ Text shadow с glow эффектом</li>
          </ul>
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: '#343434',
          borderRadius: '8px',
          color: '#999999',
          fontSize: '14px'
        }}>
          <strong style={{ color: '#FFE66D' }}>💡 Подсказка:</strong> Переключайте состояние и меняйте количество минут, чтобы увидеть progress bar в действии!
        </div>
      </div>

      <LiveScheduleCard 
        currentClass={hasClass ? "Высшая математика" : null}
        minutesLeft={hasClass ? minutesLeft : 0}
      />

      <div style={{
        maxWidth: '600px',
        margin: '40px auto 0',
        padding: '20px',
        backgroundColor: '#2A2A2A',
        borderRadius: '12px',
        color: '#999999',
        fontSize: '14px',
        lineHeight: '1.6'
      }}>
        <h3 style={{ color: '#FFFFFF', marginBottom: '16px' }}>
          📝 Что изменилось:
        </h3>
        <ul style={{ color: '#CCCCCC' }}>
          <li>❌ <strong>Удалено:</strong> Вращение круга времени</li>
          <li>✅ <strong>Добавлено:</strong> Progress bar при активном занятии</li>
          <li>✅ <strong>Добавлено:</strong> Плавные анимации дыхания и свечения</li>
          <li>✅ <strong>Добавлено:</strong> Параллакс-эффект для фоновых слоев</li>
          <li>✅ <strong>Добавлено:</strong> Улучшенные text анимации с blur</li>
          <li>✅ <strong>Добавлено:</strong> Пульсирующее box-shadow</li>
        </ul>
      </div>
    </div>
  );
}

export default AnimationDemo;
