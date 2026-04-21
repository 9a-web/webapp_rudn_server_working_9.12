/**
 * API для работы с групповыми задачами
 */

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export const groupTasksAPI = {
  /**
   * Создать групповую задачу
   */
  async createGroupTask(taskData) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при создании групповой задачи');
    }

    return response.json();
  },

  /**
   * Получить все групповые задачи пользователя
   */
  async getUserGroupTasks(telegramId) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks/${telegramId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при получении групповых задач');
    }

    return response.json();
  },

  /**
   * Получить детальную информацию о групповой задаче
   */
  async getGroupTaskDetail(taskId) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks/detail/${taskId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при получении деталей задачи');
    }

    return response.json();
  },

  /**
   * Пригласить пользователя в групповую задачу
   */
  async inviteToGroupTask(taskId, telegramId, invitedUser) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks/${taskId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task_id: taskId,
        telegram_id: telegramId,
        invited_user: invitedUser,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при приглашении пользователя');
    }

    return response.json();
  },

  /**
   * Получить приглашения пользователя
   */
  async getUserInvites(telegramId) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks/invites/${telegramId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при получении приглашений');
    }

    return response.json();
  },

  /**
   * Принять приглашение
   */
  async acceptInvite(taskId, telegramId) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks/${taskId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ telegram_id: telegramId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при принятии приглашения');
    }

    return response.json();
  },

  /**
   * Отклонить приглашение
   */
  async declineInvite(taskId, telegramId) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks/${taskId}/decline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ telegram_id: telegramId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при отклонении приглашения');
    }

    return response.json();
  },

  /**
   * Отметить задачу выполненной/невыполненной
   */
  async toggleComplete(taskId, telegramId, completed) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks/${taskId}/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task_id: taskId,
        telegram_id: telegramId,
        completed: completed,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при обновлении статуса');
    }

    return response.json();
  },

  /**
   * Покинуть групповую задачу
   */
  async leaveGroupTask(taskId, telegramId) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks/${taskId}/leave`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ telegram_id: telegramId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при выходе из задачи');
    }

    return response.json();
  },

  /**
   * Удалить групповую задачу
   */
  async deleteGroupTask(taskId, telegramId) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ telegram_id: telegramId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при удалении задачи');
    }

    return response.json();
  },

  /**
   * Добавить комментарий
   */
  async addComment(taskId, telegramId, text) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks/${taskId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task_id: taskId,
        telegram_id: telegramId,
        text: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при добавлении комментария');
    }

    return response.json();
  },

  /**
   * Получить комментарии задачи
   */
  async getComments(taskId) {
    const response = await fetch(`${API_BASE_URL}/api/group-tasks/${taskId}/comments`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка при получении комментариев');
    }

    return response.json();
  },
};
