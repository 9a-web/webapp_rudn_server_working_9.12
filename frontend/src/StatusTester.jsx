import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Тестер статусов для проверки логики определения статусов занятий
export const StatusTester = () => {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState('15:30');
  const [selectedDate, setSelectedDate] = useState('today');
  
  // Тестовые занятия
  const testClasses = [
    { discipline: 'Математика', time: '09:00-10:20', day: 'Вторник' },
    { discipline: 'Физика', time: '10:30-11:50', day: 'Вторник' },
    { discipline: 'История', time: '13:00-14:20', day: 'Вторник' },
    { discipline: 'Английский', time: '14:30-15:50', day: 'Вторник' },
    { discipline: 'Программирование', time: '16:00-17:20', day: 'Вторник' }
  ];

  const getClassStatus = (classItem, simulatedTime, dateOption) => {
    const [hours, minutes] = simulatedTime.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;

    const today = new Date();
    let selectedDateObj;
    
    if (dateOption === 'today') {
      selectedDateObj = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    } else if (dateOption === 'yesterday') {
      selectedDateObj = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    } else {
      selectedDateObj = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    }

    const isToday = selectedDateObj.toDateString() === today.toDateString();

    const timeRange = classItem.time.split('-');
    if (timeRange.length !== 2) return { status: 'Предстоит', color: '#FF6B6B' };

    const [startHour, startMin] = timeRange[0].trim().split(':').map(Number);
    const [endHour, endMin] = timeRange[1].trim().split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Если выбран прошлый день
    if (selectedDateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return { status: 'Закончилась', color: '#76EF83' };
    }

    // Если выбран будущий день
    if (selectedDateObj > new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return { status: 'Предстоит', color: '#FF6B6B' };
    }

    // Если сегодня - проверяем по времени
    if (isToday) {
      if (currentMinutes >= endTime) {
        return { status: 'Закончилась', color: '#76EF83' };
      } else if (currentMinutes >= startTime && currentMinutes < endTime) {
        return { status: 'Идёт сейчас', color: '#FFC83F' };
      } else {
        return { status: 'Предстоит', color: '#FF6B6B' };
      }
    }

    return { status: 'Предстоит', color: '#FF6B6B' };
  };

  const timeOptions = [
    '08:00', '09:30', '10:45', '12:00', '13:30', '15:00', '16:30', '18:00', '20:00'
  ];

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#1A1A1A',
      padding: '20px',
      color: '#FFFFFF'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <h1 style={{ color: '#A3F7BF', marginBottom: '30px', textAlign: 'center' }}>
          🧪 Тестер статусов занятий
        </h1>

        {/* Контроль времени */}
        <div style={{
          backgroundColor: '#2A2A2A',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: '#FFE66D', marginBottom: '15px' }}>⏰ Текущее время</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {timeOptions.map(time => (
              <button
                key={time}
                onClick={() => setCurrentTime(time)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: currentTime === time ? '#A3F7BF' : '#343434',
                  color: currentTime === time ? '#1A1A1A' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {time}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Или введите своё время:</label>
            <input
              type="time"
              value={currentTime}
              onChange={(e) => setCurrentTime(e.target.value)}
              style={{
                padding: '10px',
                backgroundColor: '#343434',
                color: '#FFFFFF',
                border: '1px solid #555',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />
          </div>
        </div>

        {/* Контроль даты */}
        <div style={{
          backgroundColor: '#2A2A2A',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '30px'
        }}>
          <h3 style={{ color: '#FFE66D', marginBottom: '15px' }}>📅 Выбранная дата</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['yesterday', 'today', 'tomorrow'].map(option => (
              <button
                key={option}
                onClick={() => setSelectedDate(option)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: selectedDate === option ? '#FFB4D1' : '#343434',
                  color: selectedDate === option ? '#1A1A1A' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: 1
                }}
              >
                {option === 'yesterday' ? 'Вчера' : option === 'today' ? 'Сегодня' : 'Завтра'}
              </button>
            ))}
          </div>
        </div>

        {/* Результаты */}
        <div style={{
          backgroundColor: '#2A2A2A',
          padding: '20px',
          borderRadius: '12px'
        }}>
          <h3 style={{ color: '#FFE66D', marginBottom: '20px' }}>📊 Результаты тестирования</h3>
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#343434', borderRadius: '8px' }}>
            <strong>Симуляция:</strong> {
              selectedDate === 'yesterday' ? 'Вчера' : selectedDate === 'today' ? 'Сегодня' : 'Завтра'
            }, время: <strong style={{ color: '#FFC83F' }}>{currentTime}</strong>
          </div>
          
          {testClasses.map((classItem, index) => {
            const status = getClassStatus(classItem, currentTime, selectedDate);
            return (
              <div
                key={index}
                style={{
                  backgroundColor: '#343434',
                  padding: '15px',
                  borderRadius: '12px',
                  marginBottom: '10px',
                  borderLeft: `4px solid ${status.color}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
                      {classItem.discipline}
                    </div>
                    <div style={{ color: '#999999' }}>
                      {classItem.time}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '8px 16px',
                      backgroundColor: status.color + '33',
                      color: status.color,
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}
                  >
                    {status.status}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Легенда */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#2A2A2A',
          borderRadius: '12px'
        }}>
          <h4 style={{ marginBottom: '10px' }}>📖 Легенда статусов:</h4>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#76EF83', borderRadius: '4px' }}></div>
              <span>Закончилась</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#FFC83F', borderRadius: '4px' }}></div>
              <span>Идёт сейчас</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#FF6B6B', borderRadius: '4px' }}></div>
              <span>Предстоит</span>
            </div>
          </div>
        </div>

        {/* Тестовые сценарии */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#2A2A2A',
          borderRadius: '12px'
        }}>
          <h4 style={{ marginBottom: '10px', color: '#C4A3FF' }}>🧪 Тестовые сценарии:</h4>
          <ol style={{ lineHeight: '1.8', color: '#CCCCCC' }}>
            <li><strong>Утро (08:00, Сегодня):</strong> Все занятия должны быть "Предстоит"</li>
            <li><strong>Во время занятия (09:30, Сегодня):</strong> Математика "Идёт сейчас", остальные "Предстоит"</li>
            <li><strong>Конец дня (18:00, Сегодня):</strong> Все занятия должны быть "Закончилась"</li>
            <li><strong>Любое время (Вчера):</strong> Все занятия "Закончилась"</li>
            <li><strong>Любое время (Завтра):</strong> Все занятия "Предстоит"</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default StatusTester;
