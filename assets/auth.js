/* ══════════════════════════════════════════════════════════
   인증 (운영 모드 · Firebase Auth)
   ──────────────────────────────────────────────────────────
   1단계 — 아이디 + 비밀번호
     Firebase 의 이메일/비밀번호 인증을 쓰되, 현장에서 이메일을
     쓰지 않는 근로자가 많으므로 화면에서는 "아이디"만 받습니다.
     내부적으로 <아이디>@LOGIN_DOMAIN 형태로 변환해 저장합니다.

   2단계(예정) — 전화번호 SMS 인증
     sendCode / verifyCode 는 미리 만들어 두었습니다.
     Firebase 콘솔에서 "전화" 로그인을 켜고 화면만 연결하면 됩니다.

   ※ 사용자 문서의 ID 는 반드시 Auth UID 와 같아야 합니다.
      Firestore 보안규칙이 uid 로 본인 여부를 판정하기 때문입니다.
   ══════════════════════════════════════════════════════════ */
import { DEMO, LOGIN_DOMAIN } from './config.js';
import { store } from './store.js';

/* ── 아이디 규칙 ───────────────────────────────────────── */
export const ID_RE = /^[a-zA-Z][a-zA-Z0-9._-]{3,19}$/;   // 영문 시작, 4~20자

export function checkId(id){
  const v = String(id || '').trim();
  if(!v) return '아이디를 입력하십시오.';
  if(!ID_RE.test(v)) return '아이디는 영문으로 시작하는 4~20자여야 합니다. (영문·숫자·. _ - 사용)';
  return '';
}
export function checkPw(pw){
  const v = String(pw || '');
  if(v.length < 6) return '비밀번호는 6자 이상이어야 합니다.';
  return '';
}

/** 화면의 아이디 → Firebase 가 쓰는 내부 주소 */
export function idToEmail(id){
  const v = String(id || '').trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${LOGIN_DOMAIN}`;
}
/** 내부 주소 → 화면용 아이디 */
export function emailToId(email){
  return String(email || '').replace(new RegExp(`@${LOGIN_DOMAIN}$`, 'i'), '');
}

/* ── 가입 · 로그인 ─────────────────────────────────────── */

/** 계정 생성 → uid 반환 */
export async function signUp(id, password){
  const fb = store.fb();
  const cred = await fb.au.createUserWithEmailAndPassword(fb.auth, idToEmail(id), password);
  return cred.user.uid;
}

/** 로그인 → uid 반환 */
export async function signIn(id, password){
  const fb = store.fb();
  const cred = await fb.au.signInWithEmailAndPassword(fb.auth, idToEmail(id), password);
  return cred.user.uid;
}

/** 비밀번호 변경 (로그인 상태에서) */
export async function changePassword(newPw){
  const fb = store.fb();
  return fb.au.updatePassword(fb.auth.currentUser, newPw);
}

/** 인증 상태가 확정될 때까지 한 번 기다림 → uid 또는 null */
export function currentUid(){
  if(DEMO) return Promise.resolve(null);
  const fb = store.fb();
  return new Promise(resolve => {
    const off = fb.au.onAuthStateChanged(fb.auth, u => { off(); resolve(u ? u.uid : null); });
  });
}

export async function logout(){
  store.clearSession();
  if(!DEMO){
    try{ await store.fb().au.signOut(store.fb().auth); }catch(e){}
  }
  verifier = null;
}

/* ══════════════════════════════════════════════════════════
   2단계 예정 — 전화번호 SMS 인증
   Firebase 콘솔에서 "전화" 로그인을 켠 뒤 화면에 연결하면 동작합니다.
   ══════════════════════════════════════════════════════════ */
let verifier = null;

/** 010-1234-5678 → +821012345678 */
export function toE164(phone, country = '+82'){
  const d = String(phone).replace(/[^0-9]/g, '');
  if(d.startsWith('82')) return '+' + d;
  return country + d.replace(/^0/, '');
}
/** +821012345678 → 010-1234-5678 */
export function toLocal(e164){
  const d = String(e164).replace(/[^0-9]/g, '').replace(/^82/, '0');
  return d.length === 11 ? `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`
       : d.length === 10 ? `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}` : d;
}

export async function sendCode(phone, containerId){
  const fb = store.fb();
  const { RecaptchaVerifier, signInWithPhoneNumber } = fb.au;
  if(!verifier){
    verifier = new RecaptchaVerifier(fb.auth, containerId, { size: 'invisible' });
    await verifier.render();
  }
  return signInWithPhoneNumber(fb.auth, toE164(phone), verifier);
}

export async function verifyCode(confirmation, code){
  const cred = await confirmation.confirm(String(code).trim());
  return cred.user.uid;
}

/* ── 오류 문구 ─────────────────────────────────────────── */
export function authMessage(e){
  const c = e?.code || '';
  if(c.includes('email-already-in-use'))  return '이미 사용 중인 아이디입니다.';
  if(c.includes('invalid-credential') ||
     c.includes('wrong-password') ||
     c.includes('user-not-found'))        return '아이디 또는 비밀번호가 맞지 않습니다.';
  if(c.includes('weak-password'))         return '비밀번호가 너무 단순합니다. 6자 이상으로 정하십시오.';
  if(c.includes('invalid-email'))         return '아이디 형식이 올바르지 않습니다.';
  if(c.includes('too-many-requests'))     return '시도가 많아 잠시 차단되었습니다. 잠시 후 다시 시도하십시오.';
  if(c.includes('network-request-failed'))return '네트워크에 연결하지 못했습니다.';
  if(c.includes('operation-not-allowed')) return '이메일/비밀번호 로그인이 아직 켜져 있지 않습니다. (Firebase → Authentication)';
  if(c.includes('unauthorized-domain'))   return '이 도메인이 승인되지 않았습니다. (Firebase → Authentication → 승인된 도메인)';
  if(c.includes('invalid-phone-number'))  return '휴대폰 번호 형식이 올바르지 않습니다.';
  if(c.includes('invalid-verification'))  return '인증번호가 올바르지 않습니다.';
  if(c.includes('code-expired'))          return '인증번호가 만료되었습니다. 다시 받아 주십시오.';
  return e?.message || '인증에 실패했습니다.';
}
