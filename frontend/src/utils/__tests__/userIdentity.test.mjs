/**
 * Quick sanity-test for userIdentity.js
 * Запуск: node /app/frontend/src/utils/__tests__/userIdentity.test.mjs
 */
import {
  PSEUDO_TID_OFFSET,
  isRealTelegramTid,
  isPseudoTid,
  getUid,
  getUidOrTid,
  isSameUser,
  getAvatarSeed,
  hashSeed,
  pickFromArray,
} from '../userIdentity.js';

let pass = 0, fail = 0;
const expect = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}\n     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`); }
};

console.log('\n── isRealTelegramTid ──');
expect('real TG id', isRealTelegramTid(771010408), true);
expect('pseudo_tid', isRealTelegramTid(10_000_000_000 + 771010408), false);
expect('null', isRealTelegramTid(null), false);
expect('string', isRealTelegramTid('771010408'), true);

console.log('\n── isPseudoTid ──');
expect('pseudo', isPseudoTid(10_000_000_000 + 771010408), true);
expect('real', isPseudoTid(771010408), false);

console.log('\n── getUid ──');
expect('user.uid', getUid({ uid: 'abc123' }), 'abc123');
expect('no uid, real tg', getUid({ telegram_id: 771010408 }), '771010408');
expect('no uid, pseudo tg', getUid({ telegram_id: 10_000_000_000 + 771010408 }), null);
expect('empty', getUid({}), null);

console.log('\n── isSameUser ──');
expect('same uid', isSameUser({ uid: 'a' }, { uid: 'a' }), true);
expect('diff uid', isSameUser({ uid: 'a' }, { uid: 'b' }), false);
expect(
  'uid vs pseudo_tid same person',
  isSameUser({ uid: '771010408' }, { id: 10_000_000_000 + 771010408 }),
  true,
);
expect(
  'uid vs real_tid same (via fallback)',
  isSameUser({ uid: '771010408' }, { telegram_id: '771010408' }),
  true,
);
expect('null guards', isSameUser(null, { uid: 'a' }), false);

console.log('\n── getAvatarSeed ──');
expect('uid priority', getAvatarSeed({ uid: 'u1', telegram_id: 999 }), 'u1');
expect('real tg fallback', getAvatarSeed({ telegram_id: 999 }), '999');
expect('pseudo fallback ok', getAvatarSeed({ telegram_id: 10_000_000_000 + 100 }), '10000000100');
expect('anon', getAvatarSeed({}), 'anonymous');

console.log('\n── hashSeed / pickFromArray ──');
const colors = ['red', 'green', 'blue', 'yellow', 'purple'];
expect('deterministic', pickFromArray(colors, 'abc') === pickFromArray(colors, 'abc'), true);
expect('hash non-neg', hashSeed('anything') >= 0, true);

console.log(`\nSummary: ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
