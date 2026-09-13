/* ══════════════════════════════════════════════════════════
   데이터 계층
   ──────────────────────────────────────────────────────────
   config.js 에 Firebase 설정이 없으면 → 데모 모드(localStorage)
   설정이 있으면                      → Firestore
   화면 코드는 아래 store API 만 사용하므로,
   전환 시 화면 코드를 고칠 필요가 없음.
   ══════════════════════════════════════════════════════════ */
import { FIREBASE, DEMO, SETTINGS_DEFAULT, TRADES_DEFAULT, SITE_DEFAULT, MAIL } from './config.js';

const KEY = 'nogada.v1';
const SKEY = 'nogada.session';

/* ── 공통 유틸 ─────────────────────────────────────────── */
export const uid = () => Math.random().toString(36).slice(2, 10);
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const nowISO = () => new Date().toISOString();
export const ymOf = d => String(d).slice(0, 7);

export function fmtDate(d){
  if(!d) return '';
  const t = new Date(d);
  if(isNaN(t)) return String(d);
  return `${t.getMonth()+1}.${t.getDate()}`;
}
export function fmtDateTime(d){
  if(!d) return '-';
  const t = new Date(d);
  if(isNaN(t)) return String(d);
  const p = n => String(n).padStart(2,'0');
  return `${t.getMonth()+1}.${t.getDate()} ${p(t.getHours())}:${p(t.getMinutes())}`;
}
export function hhmm(d){
  if(!d) return '-';
  const t = new Date(d);
  if(isNaN(t)) return String(d);
  const p = n => String(n).padStart(2,'0');
  return `${p(t.getHours())}:${p(t.getMinutes())}`;
}
export const dow = d => ['일','월','화','수','목','금','토'][new Date(d).getDay()];

/* ══════════════════════════════════════════════════════════
   데모 저장소
   ══════════════════════════════════════════════════════════ */
function blank(){
  return { users:[], attendance:[], documents:[], notices:[], noticeReads:[],
           posts:[], jobs:[], applications:[], logs:[],
           settings:{ ...SETTINGS_DEFAULT }, trades:[...TRADES_DEFAULT],
           site:{ ...SITE_DEFAULT }, mail:{ ...MAIL } };
}

function loadDemo(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ /* 저장소 차단 환경 */ }
  const seeded = seed();
  saveDemo(seeded);
  return seeded;
}
function saveDemo(db){
  try{ localStorage.setItem(KEY, JSON.stringify(db)); }catch(e){ /* 무시 */ }
}

/* ── 초기 시연 데이터 ──────────────────────────────────── */
function seed(){
  const db = blank();
  db.site.name = '봉담 제1현장';
  db.site.address = '경기도 화성시 봉담읍 상리2길 55';

  const mk = (name, role, trade, rate, part, phone, approved = true) => ({
    id: uid(), name, role, trade, unitRate: rate, part, phone,
    approved, createdAt: nowISO(), foreign: false
  });

  const dev  = mk('시스템 관리자', 'dev',  '',        0,      '본사', '010-0000-0000');
  const l1   = mk('직영 1팀장',   'lead', '형틀목공', 250000, '1팀', '010-1111-0001');
  const l2   = mk('직영 2팀장',   'lead', '철근공',   250000, '2팀', '010-2222-0001');
  const ws = [
    mk('근로자 A', 'worker', '형틀목공',   250000, '1팀', '010-1111-1001'),
    mk('근로자 B', 'worker', '형틀목공',   250000, '1팀', '010-1111-1002'),
    mk('근로자 C', 'worker', '보통인부',   160000, '1팀', '010-1111-1003'),
    mk('근로자 D', 'worker', '철근공',     250000, '2팀', '010-2222-1001'),
    mk('근로자 E', 'worker', '콘크리트공', 230000, '2팀', '010-2222-1002'),
    mk('근로자 F', 'worker', '보통인부',   160000, '2팀', '010-2222-1003', false)
  ];
  db.users = [dev, l1, l2, ...ws];

  // 이번 달 평일 출역 기록
  const today = new Date();
  const workers = ws.filter(w => w.approved);
  for(let back = 12; back >= 0; back--){
    const d = new Date(today); d.setDate(d.getDate() - back);
    if(d.getDay() === 0) continue;                 // 일요일 제외
    if(d.getMonth() !== today.getMonth()) continue;// 당월만
    const date = d.toISOString().slice(0,10);
    workers.forEach((w, i) => {
      if((back + i) % 7 === 3) return;             // 결근 섞기
      const ot = (back + i) % 4 === 0 ? 2 : 0;
      const done = back > 0;
      db.attendance.push({
        id: uid(), date, userId: w.id, part: w.part,
        checkIn: `${date}T07:0${i%6}:00`,
        checkOut: done ? `${date}T${17+ot}:0${i%6}:00` : null,
        normalHours: 8, overtimeHours: ot, nightHours: 0, holiday: d.getDay()===6 && false,
        method: i % 5 === 0 ? 'manual' : 'gps',
        status: (back===0 && i===2) ? 'pending' : 'ok',
        memo: (back===0 && i===2) ? '현장 반경 밖(자재 상차) — 승인 요청' : '',
        confirmed: back > 2
      });
    });
  }

  // 서류 제출 현황
  const docSeed = [
    [ws[0].id,'id','ok'], [ws[0].id,'bank','ok'], [ws[0].id,'safety','ok'], [ws[0].id,'contract','ok'],
    [ws[1].id,'id','ok'], [ws[1].id,'bank','ok'], [ws[1].id,'safety','wait'],
    [ws[2].id,'id','ok'], [ws[2].id,'safety','ok'],
    [ws[3].id,'id','ok'], [ws[3].id,'bank','reject'],
    [ws[4].id,'id','ok'], [ws[4].id,'bank','ok'], [ws[4].id,'safety','ok'], [ws[4].id,'contract','wait']
  ];
  docSeed.forEach(([userId, type, status], i) => {
    db.documents.push({
      id: uid(), userId, type, status,
      fileName: `${type}_${i+1}.jpg`, fileUrl: '',
      submittedAt: nowISO(), mailedAt: status !== 'wait' ? nowISO() : null,
      mailStatus: status === 'reject' ? 'fail' : (status === 'ok' ? 'sent' : 'queued'),
      rejectReason: status === 'reject' ? '통장 예금주명이 신청자와 불일치함' : ''
    });
  });

  db.notices = [{
    id: uid(), title: '10월 안전보건교육 실시 안내',
    body: '10월 정기 안전보건교육을 아래와 같이 실시함.\n\n· 일시: 매주 월요일 07:00 (작업 전)\n· 장소: 현장 사무실 앞 집결\n· 대상: 전 근로자\n\n미참석자는 당일 출역이 제한되므로 반드시 참석 바람.',
    target: 'all', popup: true, mustConfirm: true,
    from: todayISO(), to: addDays(todayISO(), 14),
    authorId: l1.id, createdAt: nowISO()
  },{
    id: uid(), title: '동절기 콘크리트 타설 지침',
    body: '기온 4℃ 이하 시 보온양생 조치 후 타설할 것. 현장소장 승인 없이 타설 금지함.',
    target: 'all', popup: false, mustConfirm: false,
    from: todayISO(), to: addDays(todayISO(), 30),
    authorId: l2.id, createdAt: nowISO()
  }];

  db.posts = [
    { id: uid(), board:'notice', title:'금주 토요일 정상 작업 안내', body:'금주 토요일은 정상 작업일임. 07:00 집결 바람.', authorId:l1.id, authorName:'직영 1팀장', anonymous:false, createdAt:nowISO(), hidden:false },
    { id: uid(), board:'free',   title:'함바집 메뉴 문의',       body:'내일 점심 메뉴 아시는 분?', authorId:ws[0].id, authorName:'근로자 A', anonymous:false, createdAt:nowISO(), hidden:false },
    { id: uid(), board:'voice',  title:'3층 화장실 온수 안 나옵니다', body:'아침마다 온수가 안 나옵니다. 확인 부탁드립니다.', authorId:ws[2].id, authorName:'익명', anonymous:true, createdAt:nowISO(), hidden:false }
  ];

  db.jobs = [
    { id: uid(), title:'형틀목공 모집 (봉담 제1현장)', trade:'형틀목공', count:6, rate:250000,
      period:'상시', location:'경기도 화성시 봉담읍', desc:'아파트 신축 현장 형틀목공 모집함.\n· 근무: 07:00~17:00 (토요일 격주)\n· 식대 별도 지급\n· 기초안전보건교육 이수증 필수',
      contact:'010-1111-0001', open:true, public:true, createdAt:nowISO() },
    { id: uid(), title:'보통인부 (일용) 상시 모집', trade:'보통인부', count:10, rate:160000,
      period:'일용', location:'경기도 화성시 봉담읍', desc:'현장 정리·자재 운반 보조 인력 모집함. 당일 출역 가능.',
      contact:'010-2222-0001', open:true, public:true, createdAt:nowISO() }
  ];

  db.applications = [{
    id: uid(), jobId: db.jobs[0].id, name:'지원자 홍○○', phone:'010-5555-1234',
    trade:'형틀목공', career:'8년', memo:'기초안전보건 이수증 보유',
    docs:[{type:'id', fileName:'신분증.jpg'},{type:'safety', fileName:'이수증.pdf'}],
    status:'wait', createdAt:nowISO(), mailStatus:'sent'
  }];

  db.mail.to = '';
  return db;
}

function addDays(iso, n){
  const d = new Date(iso); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}

/* ══════════════════════════════════════════════════════════
   store — 화면이 사용하는 유일한 API
   ══════════════════════════════════════════════════════════ */
let demoDb = null;
let fb = null;   // { db, auth, storage, fns }

export const store = {
  demo: DEMO,

  async ready(){
    if(DEMO){ demoDb = loadDemo(); return; }
    const [{ initializeApp }, fs, au, st] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js')
    ]);
    const app = initializeApp(FIREBASE);
    fb = { app, fs, au, st, db: fs.getFirestore(app), auth: au.getAuth(app), storage: st.getStorage(app) };
  },

  /* ── 조회 ──────────────────────────────────────────── */
  async list(col, where = null){
    if(DEMO){
      let rows = (demoDb[col] || []).slice();
      if(where) rows = rows.filter(where);
      return rows;
    }
    const { collection, getDocs } = fb.fs;
    const snap = await getDocs(collection(fb.db, col));
    let rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if(where) rows = rows.filter(where);
    return rows;
  },

  async get(col, id){
    if(DEMO) return (demoDb[col] || []).find(r => r.id === id) || null;
    const { doc, getDoc } = fb.fs;
    const s = await getDoc(doc(fb.db, col, id));
    return s.exists() ? { id:s.id, ...s.data() } : null;
  },

  /* ── 쓰기 ──────────────────────────────────────────── */
  async add(col, obj){
    const rec = { ...obj, createdAt: obj.createdAt || nowISO() };
    if(DEMO){
      rec.id = rec.id || uid();
      (demoDb[col] = demoDb[col] || []).push(rec);
      saveDemo(demoDb);
      return rec;
    }
    const { collection, addDoc } = fb.fs;
    const ref = await addDoc(collection(fb.db, col), rec);
    return { id: ref.id, ...rec };
  },

  async update(col, id, patch){
    if(DEMO){
      const r = (demoDb[col] || []).find(x => x.id === id);
      if(r) Object.assign(r, patch);
      saveDemo(demoDb);
      return r;
    }
    const { doc, updateDoc } = fb.fs;
    await updateDoc(doc(fb.db, col, id), patch);
    return this.get(col, id);
  },

  async remove(col, id){
    if(DEMO){
      demoDb[col] = (demoDb[col] || []).filter(x => x.id !== id);
      saveDemo(demoDb);
      return;
    }
    const { doc, deleteDoc } = fb.fs;
    await deleteDoc(doc(fb.db, col, id));
  },

  /* ── 단일 문서(설정류) ─────────────────────────────── */
  async meta(key){
    if(DEMO) return demoDb[key];
    const { doc, getDoc } = fb.fs;
    const s = await getDoc(doc(fb.db, 'meta', key));
    if(s.exists()) return s.data();
    const fallback = { settings:SETTINGS_DEFAULT, site:SITE_DEFAULT, mail:MAIL,
                       trades:{ list:TRADES_DEFAULT } }[key];
    return fallback;
  },

  async saveMeta(key, value){
    if(DEMO){ demoDb[key] = value; saveDemo(demoDb); return; }
    const { doc, setDoc } = fb.fs;
    await setDoc(doc(fb.db, 'meta', key), value, { merge:true });
  },

  /* ── 수정 이력 ─────────────────────────────────────── */
  async log(entity, entityId, action, detail, actor){
    return this.add('logs', {
      entity, entityId, action, detail,
      actorId: actor?.id || '', actorName: actor?.name || '', at: nowISO()
    });
  },

  /* ── 세션 ──────────────────────────────────────────── */
  session(){
    try{ return JSON.parse(sessionStorage.getItem(SKEY) || localStorage.getItem(SKEY) || 'null'); }
    catch(e){ return null; }
  },
  setSession(u, remember = true){
    try{
      const s = JSON.stringify(u);
      sessionStorage.setItem(SKEY, s);
      if(remember) localStorage.setItem(SKEY, s); else localStorage.removeItem(SKEY);
    }catch(e){}
  },
  clearSession(){
    try{ sessionStorage.removeItem(SKEY); localStorage.removeItem(SKEY); }catch(e){}
  },

  /* ── 데모 초기화 ───────────────────────────────────── */
  resetDemo(){
    try{ localStorage.removeItem(KEY); }catch(e){}
    demoDb = null;
  }
};
