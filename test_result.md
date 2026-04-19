backend:
  - task: "Stage 1: Auth — POST /api/auth/register/email"
    implemented: true
    working: false
    file: "backend/auth_routes.py"
    stuck_count: 1
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Email+password регистрация. Создаёт пользователя, генерит 9-digit UID, возвращает JWT. Дубликат email → 409. Минимальная длина пароля 6."
      - working: false
        agent: "testing"
        comment: "CRITICAL BUG: Email registration fails with 409 due to MongoDB unique constraint violation on telegram_id field. Error: 'E11000 duplicate key error collection: test_database.users index: telegram_id_1 dup key: { telegram_id: null }'. Multiple users with telegram_id=null violate unique constraint. Password validation (422 for short passwords) works correctly."

  - task: "Stage 1: Auth — POST /api/auth/login/email"
    implemented: true
    working: false
    file: "backend/auth_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Email+пароль логин с bcrypt-проверкой. Неверные данные → 401."
      - working: false
        agent: "testing"
        comment: "Cannot test login due to registration failure. Endpoint structure appears correct based on code review."

  - task: "Stage 1: Auth — POST /api/auth/login/telegram"
    implemented: true
    working: true
    file: "backend/auth_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Telegram Login Widget — проверка HMAC-hash + auth_date. Создаёт user по telegram_id или находит существующего."
      - working: true
        agent: "testing"
        comment: "Telegram hash validation working correctly. Invalid hash properly rejected with 401 'Невалидная подпись Telegram'."

  - task: "Stage 1: Auth — POST /api/auth/login/telegram-webapp"
    implemented: true
    working: "NA"
    file: "backend/auth_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Telegram WebApp initData валидация (HMAC-SHA256 с 'WebAppData'). Auto-link к telegram_id."
      - working: "NA"
        agent: "testing"
        comment: "Not tested - requires valid Telegram WebApp initData which is complex to generate for testing."

  - task: "Stage 1: Auth — POST /api/auth/login/vk"
    implemented: true
    working: true
    file: "backend/auth_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "VK ID OAuth — обмен code→token через id.vk.com с fallback на oauth.vk.com. Fetches profile через users.get."
      - working: true
        agent: "testing"
        comment: "VK OAuth validation working correctly. Fake code properly rejected with 401. No 500 errors observed."

  - task: "Stage 1: Auth — QR login (init/status/confirm)"
    implemented: true
    working: true
    file: "backend/auth_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /login/qr/init создаёт QR-сессию (TTL 5 мин). GET /login/qr/{token}/status — polling. POST /login/qr/{token}/confirm — подтверждение с auth-устройства."
      - working: true
        agent: "testing"
        comment: "QR login flow working correctly. Init creates session with proper structure (qr_token, qr_url, expires_at, status=pending). Status polling works. Confirm requires valid JWT (cannot test full flow due to registration issue)."

  - task: "Stage 1: Auth — GET /api/auth/me"
    implemented: true
    working: true
    file: "backend/auth_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Возвращает UserPublic текущего юзера по JWT. 401 если токен невалиден."
      - working: true
        agent: "testing"
        comment: "JWT validation working correctly. Missing token returns 401. Invalid token returns 401. Cannot test valid token due to registration issue."

  - task: "Stage 1: Auth — GET /api/auth/check-username/{username}"
    implemented: true
    working: true
    file: "backend/auth_routes.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Проверка уникальности username (case-insensitive). Длина 3-32, только a-z0-9_. Зарезервированные слова → false."
      - working: true
        agent: "testing"
        comment: "Username validation working perfectly. Correctly rejects: short usernames (< 3 chars), reserved words (admin), invalid characters. Returns proper available/reason structure."

  - task: "Stage 1: Auth — PATCH /api/auth/profile-step"
    implemented: true
    working: false
    file: "backend/auth_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Шаги 2-3 регистрационного визарда. Обновляет username/имя/факультет/группу. Зеркалит в user_settings для обратной совместимости."
      - working: false
        agent: "testing"
        comment: "Cannot test due to registration failure preventing JWT token acquisition."

  - task: "Stage 1: Миграция user_settings → users"
    implemented: true
    working: true
    file: "backend/auth_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "При старте backend все существующие user_settings без uid получают user-запись с уникальным UID. Идемпотентна."
      - working: true
        agent: "testing"
        comment: "Migration appears to have run (evidenced by existing users in database). However, migration may have created the telegram_id constraint issue."

  - task: "Stage 1: MongoDB индексы для users + auth_qr_sessions"
    implemented: true
    working: false
    file: "backend/server.py"
    stuck_count: 1
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Unique indexes: uid, email (sparse), telegram_id (sparse), vk_id (sparse), username (sparse). TTL index на auth_qr_sessions.expires_at."
      - working: false
        agent: "testing"
        comment: "CRITICAL BUG: telegram_id unique index is causing constraint violations. Despite sparse=True in code, existing non-sparse index prevents multiple users with telegram_id=null. This blocks email-only user registration."

frontend:
  - task: "Frontend auth flow (Stage 3)"
    implemented: false
    working: "NA"
    file: "frontend/src/..."
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Не начато. Будет делаться после Stage 1+2 backend."

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Stage 1: Auth — POST /api/auth/register/email"
    - "Stage 1: MongoDB индексы для users + auth_qr_sessions"
  stuck_tasks:
    - "Stage 1: Auth — POST /api/auth/register/email"
    - "Stage 1: MongoDB индексы для users + auth_qr_sessions"
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "🔐 Stage 1 Auth Foundation готов. Реализованы 12 auth endpoints (register/login email, telegram widget, telegram webapp, VK, QR init/status/confirm, me, logout, link/email, check-username, profile-step). Создана коллекция users с numeric 9-digit UID. Миграция user_settings → users при старте. Пожалуйста протестируйте ВСЕ auth endpoints: регистрация email, логин, /me с JWT, проверка username, 401 на невалидные токены, 409 на дубликаты. ПОКА НЕ ТРОГАТЬ VK/Telegram Login Widget (нужны real-world credentials) и QR confirm (требует end-to-end flow). Для QR можно только проверить init+status. IMPORTANT: также протестируйте что старые endpoints /api/profile/{telegram_id} продолжают работать (backward compatibility)."
  - agent: "testing"
    message: "🔴 CRITICAL BUG FOUND: Email registration completely broken due to MongoDB unique constraint violation on telegram_id field. Error: 'E11000 duplicate key error collection: test_database.users index: telegram_id_1 dup key: { telegram_id: null }'. Multiple email-only users cannot be created because they all have telegram_id=null which violates unique constraint. This blocks the entire email registration flow. ✅ Working: username validation, Telegram hash validation, VK OAuth validation, QR login init/status, JWT validation (/me endpoint), backward compatibility endpoints. ❌ Broken: email registration, email login (due to registration failure), profile updates (due to no valid tokens). URGENT: Fix telegram_id index to be properly sparse or handle null values correctly."
