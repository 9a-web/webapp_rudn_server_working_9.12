/**
 * 🧩 userIdentity.js — единый хелпер работы с идентификаторами пользователя.
 *
 * Проблема, которую решает:
 *   В системе живут ТРИ параллельных ID одного и того же человека:
 *     - Telegram ID (`telegram_id`) — настоящий ID, только для TG-юзеров.
 *     - Pseudo Telegram ID — синтетический (telegram_id = 10_000_000_000 + uid),
 *       создаётся для VK/Email/QR-юзеров, т.к. legacy-схема требует поле telegram_id.
 *     - UID — канонический идентификатор (`users.uid`), общий для всех провайдеров.
 *
 *   Раньше фронт смешивал их → сравнения "это я?" и "это админ?" ломались
 *   для VK/Email юзеров. Теперь — только через функции из этого модуля.
 *
 * Используйте:
 *   - isSameUser(a, b)       — сравнение двух юзеров (безопасное, с нормализацией)
 *   - getUid(user)           — канонический идентификатор
 *   - getUidOrTid(user)      — uid, если есть, иначе telegram_id (для URL /u/{...})
 *   - isRealTelegramTid(tid) — это настоящий Telegram ID?
 *   - isPseudoTid(tid)       — это pseudo_tid?
 *   - getAvatarSeed(user)    — стабильный seed для генерации аватара
 */

/**
 * Граница между real TG и pseudo_tid. Должна совпадать с
 * `auth_utils.PSEUDO_TID_OFFSET` на backend (= 10_000_000_000).
 * Реальные Telegram ID пока <= ~8_000_000_000, синтетические начинаются с 10e9.
 */
export const PSEUDO_TID_OFFSET = 10_000_000_000;

/** Нормализует любой вход (int/string/BigInt/null) в Number или null. */
const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Нормализует идентификатор в строку (или null). */
const toStringOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
};

/**
 * `true` если tid представляет реального Telegram-пользователя
 * (положительный и < PSEUDO_TID_OFFSET).
 */
export const isRealTelegramTid = (tid) => {
  const n = toNumberOrNull(tid);
  if (n === null) return false;
  return n > 0 && n < PSEUDO_TID_OFFSET;
};

/** `true` если tid — синтетический (сгенерирован для VK/Email/QR юзера). */
export const isPseudoTid = (tid) => {
  const n = toNumberOrNull(tid);
  if (n === null) return false;
  return n >= PSEUDO_TID_OFFSET;
};

/**
 * Возвращает канонический UID пользователя.
 * Порядок приоритета: user.uid → user.user_uid → (если real TG) user.telegram_id.
 * Для pseudo_tid-юзеров без uid возвращает null (их всегда идентифицируем по uid).
 */
export const getUid = (user) => {
  if (!user || typeof user !== 'object') return null;
  const direct = toStringOrNull(user.uid ?? user.user_uid);
  if (direct) return direct;
  // Fallback для legacy-форматов: real telegram_id может служить uid
  const tid = user.telegram_id ?? user.id;
  if (isRealTelegramTid(tid)) return toStringOrNull(tid);
  return null;
};

/**
 * UID если есть, иначе telegram_id (в т.ч. pseudo_tid).
 * Используется для построения URL `/u/{uid_or_tid}/` — backend умеет
 * dual-accept.
 */
export const getUidOrTid = (user) => {
  const uid = getUid(user);
  if (uid) return uid;
  const tid = toStringOrNull(user?.telegram_id ?? user?.id);
  return tid;
};

/**
 * Сравнение «это тот же пользователь?» — устойчиво к типам и смеси identifier'ов.
 * Сравнивает по uid (приоритет), затем по real telegram_id.
 *
 *   isSameUser({uid: '771010408'}, {id: 10_000_000_771010408}) → true (pseudo→uid)
 *   isSameUser({uid: '771010408'}, {telegram_id: '771010408'}) → true (real TG совпадает с uid)
 *   isSameUser({uid: 'a'}, {uid: 'b'}) → false
 */
export const isSameUser = (a, b) => {
  if (!a || !b) return false;

  // 1. UID — самый надёжный
  const uidA = getUid(a);
  const uidB = getUid(b);
  if (uidA && uidB) return uidA === uidB;

  // 2. pseudo_tid ↔ uid кросс-совпадение
  // (user.telegram_id = 10_000_000_000 + parseInt(otherUser.uid))
  const tidA = toNumberOrNull(a.telegram_id ?? a.id);
  const tidB = toNumberOrNull(b.telegram_id ?? b.id);

  if (tidA && isPseudoTid(tidA) && uidB) {
    if (String(tidA - PSEUDO_TID_OFFSET) === uidB) return true;
  }
  if (tidB && isPseudoTid(tidB) && uidA) {
    if (String(tidB - PSEUDO_TID_OFFSET) === uidA) return true;
  }

  // 3. real telegram_id совпадает
  if (tidA && tidB && isRealTelegramTid(tidA) && isRealTelegramTid(tidB)) {
    return tidA === tidB;
  }

  return false;
};

/**
 * Стабильный seed для генерации аватара.
 * Приоритет: uid → real telegram_id → pseudo_tid → username → 'anonymous'.
 *
 * Важно: **uid имеет приоритет перед telegram_id**, чтобы аватар был одинаковым
 * для юзера, вошедшего через VK (pseudo_tid) и через TG (real_tid) после
 * линковки аккаунтов.
 */
export const getAvatarSeed = (user) => {
  if (!user) return 'anonymous';
  const uid = getUid(user);
  if (uid) return uid;
  const tid = toStringOrNull(user.telegram_id ?? user.id);
  if (tid) return tid;
  if (user.username) return String(user.username);
  if (user.email) return String(user.email);
  return 'anonymous';
};

/**
 * Хэш строки → целое число (детерминированный, для выбора элемента из массива).
 * Используется с getAvatarSeed: pickFromArray(arr, getAvatarSeed(user)).
 */
export const hashSeed = (seed) => {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0; // 32-bit integer hash
  }
  return Math.abs(h);
};

/**
 * Выбор элемента из массива по детерминированному seed.
 * Всегда возвращает тот же элемент для одного и того же user.
 */
export const pickFromArray = (arr, seed) => {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[hashSeed(seed) % arr.length];
};

export default {
  PSEUDO_TID_OFFSET,
  isRealTelegramTid,
  isPseudoTid,
  getUid,
  getUidOrTid,
  isSameUser,
  getAvatarSeed,
  hashSeed,
  pickFromArray,
};
