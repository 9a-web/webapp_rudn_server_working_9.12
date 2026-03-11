/**
 * 🛠 Dev Console — команды разработчика в браузерной консоли
 * 
 * Использование: откройте F12 → Console и введите:
 *   dev.help()                         — список всех команд
 *   dev.getUser()                      — текущий пользователь
 *   dev.createFriend(targetId)         — создать тестового друга
 *   dev.addTask("Название")            — создать задачу
 *   dev.showStreakModal()              — показать модалку стрика
 *   dev.setStreak(days)               — установить стрик (напрямую в БД)
 */

import axios from 'axios';
import { getBackendURL } from './config';

const API = `${getBackendURL()}/api`;

// Ссылки на React state — будут установлены из App.jsx
let _appRefs = {
  getUser: () => null,
  setShowStreakModal: null,
  setStreakData: null,
  getUserSettings: () => null,
};

/**
 * Инициализация dev console — вызывается из App.jsx
 */
export function initDevConsole(refs) {
  _appRefs = { ..._appRefs, ...refs };

  // Не регистрируем в production Telegram WebApp (только web/desktop)
  if (typeof window === 'undefined') return;

  window.dev = devCommands;
  console.log(
    '%c🛠 Dev Console активна %c— введите dev.help() для списка команд',
    'background:#1C1C1E;color:#F7D060;padding:4px 8px;border-radius:4px;font-weight:bold',
    'color:#8E8E93'
  );
}

// ─── Вспомогательные функции ───

function getCurrentUserId() {
  const u = _appRefs.getUser();
  if (!u?.id) {
    console.error('❌ Пользователь не найден. Откройте приложение.');
    return null;
  }
  return u.id;
}

function log(emoji, msg, data) {
  if (data !== undefined) {
    console.log(`${emoji} ${msg}`, data);
  } else {
    console.log(`${emoji} ${msg}`);
  }
}

// ─── Команды ───

const devCommands = {

  /** Показать справку */
  help() {
    console.log(`
%c🛠 Dev Console — Команды разработчика%c

%cПользователь:%c
  dev.getUser()                    — текущий пользователь (объект)
  dev.getUserSettings()            — настройки пользователя из БД
  dev.createUser(id, name)         — создать тестового пользователя

%cДрузья:%c
  dev.createFriend(targetId)       — создать друга (отправить + принять)
  dev.listFriends()                — список друзей
  dev.removeFriend(targetId)       — удалить друга
  dev.sendFriendRequest(targetId)  — только отправить запрос
  dev.listRequests()               — входящие запросы

%cЗадачи:%c
  dev.addTask("Название")          — создать задачу
  dev.listTasks()                  — список задач
  dev.deleteTask(taskId)           — удалить задачу

%cСтрик:%c
  dev.showStreakModal()            — показать модалку стрика
  dev.hideStreakModal()            — скрыть модалку стрика
  dev.recordVisit()                — записать визит
  dev.setStreak(days)              — установить стрик (в БД)

%cДанные:%c
  dev.clearUserData()              — удалить настройки текущего юзера
  dev.apiCall(method, path, body)  — произвольный API вызов
`,
      'font-size:14px;font-weight:bold;color:#F7D060', '',
      'color:#60A5FA;font-weight:bold', '',
      'color:#34D399;font-weight:bold', '',
      'color:#F472B6;font-weight:bold', '',
      'color:#FBBF24;font-weight:bold', '',
      'color:#A78BFA;font-weight:bold', '',
    );
  },

  // ═══════ Пользователь ═══════

  getUser() {
    const u = _appRefs.getUser();
    log('👤', 'Текущий пользователь:', u);
    return u;
  },

  async getUserSettings() {
    const id = getCurrentUserId();
    if (!id) return;
    try {
      const { data } = await axios.get(`${API}/user-settings/${id}`);
      log('⚙️', `Настройки пользователя ${id}:`, data);
      return data;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  async createUser(telegramId, firstName = 'Тест') {
    try {
      const { data } = await axios.post(`${API}/user-settings`, {
        telegram_id: telegramId,
        first_name: firstName,
        last_name: 'Dev',
        username: `dev_user_${telegramId}`,
      });
      log('✅', `Пользователь ${telegramId} создан:`, data);
      return data;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  // ═══════ Друзья ═══════

  async createFriend(targetId) {
    const myId = getCurrentUserId();
    if (!myId) return;
    if (!targetId) {
      console.error('❌ Укажите targetId: dev.createFriend(222222)');
      return;
    }

    try {
      // 1. Убедимся что target существует
      log('📝', `Создаём пользователя ${targetId} если не существует...`);
      try {
        await axios.post(`${API}/user-settings`, {
          telegram_id: targetId,
          first_name: `Друг_${targetId}`,
          last_name: 'Тестовый',
          username: `test_friend_${targetId}`,
        });
      } catch (e) {
        // Уже существует — ok
      }

      // 2. Отправляем запрос
      log('📨', `Отправляем запрос в друзья ${myId} → ${targetId}...`);
      const { data: reqResult } = await axios.post(`${API}/friends/request/${targetId}`, {
        telegram_id: myId,
      });
      log('📨', 'Запрос отправлен:', reqResult);

      // 3. Принимаем запрос
      if (reqResult.request_id) {
        log('✅', `Принимаем запрос ${reqResult.request_id}...`);
        const { data: acceptResult } = await axios.post(`${API}/friends/accept/${reqResult.request_id}`, {
          telegram_id: targetId,
        });
        log('🤝', `Друг ${targetId} добавлен!`, acceptResult);
        return acceptResult;
      } else {
        log('⚠️', 'Не удалось получить request_id. Возможно, уже друзья.');
        return reqResult;
      }
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  async listFriends() {
    const id = getCurrentUserId();
    if (!id) return;
    try {
      const { data } = await axios.get(`${API}/friends/${id}`);
      log('👥', `Друзья (${data.friends?.length || 0}):`, data.friends);
      return data.friends;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  async removeFriend(targetId) {
    const id = getCurrentUserId();
    if (!id) return;
    try {
      const { data } = await axios.delete(`${API}/friends/${targetId}`, {
        data: { telegram_id: id },
      });
      log('🗑', `Друг ${targetId} удалён:`, data);
      return data;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  async sendFriendRequest(targetId) {
    const id = getCurrentUserId();
    if (!id) return;
    try {
      const { data } = await axios.post(`${API}/friends/request/${targetId}`, {
        telegram_id: id,
      });
      log('📨', 'Запрос отправлен:', data);
      return data;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  async listRequests() {
    const id = getCurrentUserId();
    if (!id) return;
    try {
      const { data } = await axios.get(`${API}/friends/${id}/requests`);
      log('📬', `Запросы (вх: ${data.incoming?.length || 0}, исх: ${data.outgoing?.length || 0}):`, data);
      return data;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  // ═══════ Задачи ═══════

  async addTask(text = 'Тестовая задача', opts = {}) {
    const id = getCurrentUserId();
    if (!id) return;
    try {
      const { data } = await axios.post(`${API}/tasks`, {
        telegram_id: id,
        text,
        ...opts,
      });
      log('✅', 'Задача создана:', data);
      return data;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  async listTasks() {
    const id = getCurrentUserId();
    if (!id) return;
    try {
      const { data } = await axios.get(`${API}/tasks/${id}`);
      log('📋', `Задачи (${data.length}):`, data);
      return data;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  async deleteTask(taskId) {
    if (!taskId) {
      console.error('❌ Укажите taskId: dev.deleteTask("uuid...")');
      return;
    }
    try {
      const { data } = await axios.delete(`${API}/tasks/${taskId}`);
      log('🗑', 'Задача удалена:', data);
      return data;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  // ═══════ Стрик ═══════

  showStreakModal() {
    if (_appRefs.setShowStreakModal) {
      // Если нет streakData — создаём моковые
      if (_appRefs.setStreakData) {
        _appRefs.setStreakData(prev => prev || {
          visit_streak_current: 3,
          visit_streak_max: 3,
          freeze_shields: 1,
          streak_continued: true,
          streak_reset: false,
          is_new_day: true,
          milestone_reached: 3,
          week_days: [
            { label: 'Пн', dateNum: 1, done: true },
            { label: 'Вт', dateNum: 2, done: true },
            { label: 'Ср', dateNum: 3, done: true },
            { label: 'Чт', dateNum: 4, done: false },
            { label: 'Пт', dateNum: 5, done: false },
            { label: 'Сб', dateNum: 6, done: false },
            { label: 'Вс', dateNum: 7, done: false },
          ],
        });
      }
      _appRefs.setShowStreakModal(true);
      log('🔥', 'Модалка стрика показана');
    } else {
      log('❌', 'setShowStreakModal не привязан');
    }
  },

  hideStreakModal() {
    if (_appRefs.setShowStreakModal) {
      _appRefs.setShowStreakModal(false);
      log('🔥', 'Модалка стрика скрыта');
    }
  },

  async recordVisit() {
    const id = getCurrentUserId();
    if (!id) return;
    try {
      const { data } = await axios.post(`${API}/users/${id}/visit`);
      log('🔥', 'Визит записан:', data);
      if (_appRefs.setStreakData) _appRefs.setStreakData(data);
      return data;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  async setStreak(days = 7) {
    const id = getCurrentUserId();
    if (!id) return;
    try {
      // Напрямую обновляем user_stats через visit endpoint не получится,
      // поэтому используем специальный трюк — записываем визит и смотрим текущий стрик
      // Для точной установки нужен прямой доступ к БД, поэтому делаем через recordVisit
      const { data } = await axios.post(`${API}/users/${id}/visit`);
      log('🔥', `Текущий стрик: ${data.visit_streak_current} дней (для точной установки нужен доступ к БД)`);
      log('💡', `Совет: используйте mongosh для установки точного значения:\n  db.user_stats.updateOne({telegram_id: ${id}}, {$set: {visit_streak_current: ${days}, visit_streak_max: ${days}}})`);
      if (_appRefs.setStreakData) {
        _appRefs.setStreakData({ ...data, visit_streak_current: days, visit_streak_max: Math.max(days, data.visit_streak_max) });
      }
      return data;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  // ═══════ Данные ═══════

  async clearUserData() {
    const id = getCurrentUserId();
    if (!id) return;
    try {
      const { data } = await axios.delete(`${API}/user-settings/${id}`);
      log('🗑', 'Данные пользователя удалены:', data);
      return data;
    } catch (e) {
      log('❌', 'Ошибка:', e.response?.data || e.message);
    }
  },

  /** Произвольный API вызов: dev.apiCall('GET', '/admin/stats') */
  async apiCall(method = 'GET', path = '/', body = null) {
    try {
      const url = `${API}${path.startsWith('/') ? path : '/' + path}`;
      const config = { method: method.toUpperCase(), url };
      if (body) config.data = body;
      const { data } = await axios(config);
      log('📡', `${method.toUpperCase()} ${path}:`, data);
      return data;
    } catch (e) {
      log('❌', `${method.toUpperCase()} ${path}:`, e.response?.data || e.message);
    }
  },
};

export default devCommands;
