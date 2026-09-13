/* ══════════════════════════════════════════════════════════
   공통 UI · 세션 가드 · 공지 팝업 · 메일 발송
   ══════════════════════════════════════════════════════════ */
import { store, nowISO, todayISO } from './store.js';
import { ROLES, DEMO } from './config.js';

/* ── DOM 헬퍼 ──────────────────────────────────────────── */
export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
export const el = (tag, attrs = {}, html = '') => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if(k === 'class') n.className = v; else n.setAttribute(k, v);
  });
  if(html) n.innerHTML = html;
  return n;
};

/* ── 토스트 ────────────────────────────────────────────── */
let toastTimer;
export function toast(msg, ms = 2600){
  let t = $('#toast');
  if(!t){ t = el('div', { id:'toast' }); document.body.appendChild(t); }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ── 모달 ──────────────────────────────────────────────── */
export function modal({ title, body, actions = [], dismissable = true }){
  return new Promise(resolve => {
    const bg = el('div', { class:'modal-bg', role:'dialog', 'aria-modal':'true' });
    const box = el('div', { class:'modal' });
    box.innerHTML = `
      <div class="modal-h"><h3>${esc(title)}</h3></div>
      <div class="modal-b">${body}</div>`;
    const foot = el('div', { class:'modal-f' });
    const close = v => { bg.remove(); resolve(v); };

    (actions.length ? actions : [{ label:'닫기', value:true }]).forEach(a => {
      const b = el('button', { class:'btn ' + (a.cls || '') }, esc(a.label));
      b.onclick = () => {
        if(a.before && a.before(box) === false) return;
        close(a.value);
      };
      foot.appendChild(b);
    });
    box.appendChild(foot);
    bg.appendChild(box);
    if(dismissable) bg.addEventListener('click', e => { if(e.target === bg) close(null); });
    document.body.appendChild(bg);
    const first = box.querySelector('input,select,textarea,button');
    if(first) first.focus();
  });
}

export const confirmBox = (title, msg, okLabel = '확인') =>
  modal({ title, body:`<p>${esc(msg).replace(/\n/g,'<br>')}</p>`, actions:[
    { label:'취소', value:false },
    { label:okLabel, value:true, cls:'btn-p' }
  ]});

/* ── 상단바 ────────────────────────────────────────────── */
export function topbar(user, right = ''){
  const role = ROLES[user?.role];
  const bar = el('div', { class:'topbar' });
  bar.innerHTML = `
    <div class="wrap topbar-in">
      <a class="brand" href="${user ? role.home : 'index.html'}">
        <span class="mark">工</span><span>노가다의신</span>
      </a>
      <div class="row">
        ${right}
        ${user ? `<span class="whoami">
            <span class="tag t-info">${esc(role.label)}</span>
            <span class="nm">${esc(user.name)}</span>
          </span>
          <button class="btn btn-sm" id="btnLogout">로그아웃</button>` : ''}
      </div>
    </div>`;
  document.body.prepend(bar);
  if(DEMO){
    const d = el('div', { class:'demobar' },
      '데모 모드 — 이 브라우저에만 저장됩니다. Firebase 설정 후 실제 운영으로 전환하십시오.');
    document.body.prepend(d);
  }
  const lo = $('#btnLogout');
  if(lo) lo.onclick = () => { store.clearSession(); location.href = 'index.html'; };
  return bar;
}

/* ── 접근 제어 ─────────────────────────────────────────── */
export async function guard(minRank){
  await store.ready();
  const s = store.session();
  if(!s){ location.replace('index.html'); return null; }
  const u = await store.get('users', s.id);
  if(!u){ store.clearSession(); location.replace('index.html'); return null; }
  if(ROLES[u.role].rank < minRank){
    alert('접근 권한이 없습니다.');
    location.replace(ROLES[u.role].home);
    return null;
  }
  if(!u.approved && u.role === 'worker'){
    document.body.innerHTML = '';
    topbar(u);
    const w = el('div', { class:'wrap-narrow', style:'padding-block:40px' });
    w.innerHTML = `<div class="card">
      <h3>승인 대기 중</h3>
      <p class="muted">관리자 승인 후 출퇴근·서류제출 기능이 활성화됩니다.
      승인이 지연되면 소속 직영팀장에게 문의하십시오.</p>
      <button class="btn" onclick="location.reload()">새로고침</button>
    </div>`;
    document.body.appendChild(w);
    return null;
  }
  return u;
}

/* ── 공지 팝업 ─────────────────────────────────────────── */
export async function showNoticePopup(user){
  const today = todayISO();
  const skipKey = 'nogada.noticeSkip';
  let skip = {};
  try{ skip = JSON.parse(localStorage.getItem(skipKey) || '{}'); }catch(e){}

  const notices = (await store.list('notices'))
    .filter(n => n.popup)
    .filter(n => (!n.from || n.from <= today) && (!n.to || n.to >= today))
    .filter(n => n.target === 'all' || n.target === user.part || n.target === user.id);

  const reads = await store.list('noticeReads', r => r.userId === user.id);

  for(const n of notices){
    const read = reads.find(r => r.noticeId === n.id);
    if(read) continue;
    if(!n.mustConfirm && skip[n.id] === today) continue;

    const acts = [];
    if(!n.mustConfirm) acts.push({ label:'오늘 하루 안 보기', value:'skip' });
    acts.push({ label: n.mustConfirm ? '확인했습니다' : '닫기', value:'read', cls:'btn-p' });

    const r = await modal({
      title: n.title,
      dismissable: !n.mustConfirm,
      body: `<p class="small muted mono">${esc(n.from)} ~ ${esc(n.to)}${n.mustConfirm ? ' · 확인 필수' : ''}</p>
             <p>${esc(n.body).replace(/\n/g,'<br>')}</p>`,
      actions: acts
    });

    if(r === 'skip'){
      skip[n.id] = today;
      try{ localStorage.setItem(skipKey, JSON.stringify(skip)); }catch(e){}
    }else if(r === 'read' || n.mustConfirm){
      await store.add('noticeReads', { noticeId:n.id, userId:user.id, at:nowISO() });
    }
  }
}

/* ══════════════════════════════════════════════════════════
   서류 자동 이메일
   ──────────────────────────────────────────────────────────
   데모 모드에서는 발송 내역만 기록합니다.
   운영 전환 시 아래 sendMail 내부를 Cloud Functions 호출로
   교체하면 화면 코드는 그대로 사용 가능합니다.
   ══════════════════════════════════════════════════════════ */
export async function sendMail({ subject, lines, files = [] }){
  const mail = await store.meta('mail');
  const to = mail?.to || '';

  const body = [
    ...lines,
    '',
    files.length ? '[첨부]' : '',
    ...files.map(f => ` · ${f.fileName}${f.url ? ' — ' + f.url : ''}`),
    '',
    '— 노가다의신 자동발송'
  ].filter(Boolean).join('\n');

  if(!to){
    return { ok:false, reason:'수신처 미지정', subject, body };
  }

  if(DEMO){
    // 데모: 실제 발송 없이 큐에만 적재
    await store.add('logs', {
      entity:'mail', entityId:'', action:'queued',
      detail:`받는사람 ${to} / ${subject}`, at: nowISO()
    });
    return { ok:true, demo:true, to, subject, body };
  }

  // 운영: Cloud Functions(sendDocumentMail) 호출
  try{
    const res = await fetch(`https://us-central1-${(await store.meta('site'))?.projectId || ''}.cloudfunctions.net/sendDocumentMail`, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ to, subject, body, files, mode: mail.mode })
    });
    return { ok: res.ok, to, subject };
  }catch(e){
    return { ok:false, reason:String(e), to, subject };
  }
}

/* ── 파일 → dataURL (데모 저장용, 1MB 제한) ───────────── */
export function readFileAsURL(file, maxBytes = 1024 * 1024){
  return new Promise(resolve => {
    if(!file || file.size > maxBytes) return resolve('');
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve('');
    r.readAsDataURL(file);
  });
}

/* ── 위치 조회 ─────────────────────────────────────────── */
export function getPosition(timeout = 8000){
  return new Promise(resolve => {
    if(!navigator.geolocation) return resolve({ ok:false, reason:'이 기기는 위치 기능을 지원하지 않습니다.' });
    navigator.geolocation.getCurrentPosition(
      p => resolve({ ok:true, lat:p.coords.latitude, lng:p.coords.longitude, acc:Math.round(p.coords.accuracy) }),
      e => resolve({ ok:false, reason: e.code === 1
        ? '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용해 주십시오.'
        : '위치를 확인하지 못했습니다. 실외에서 다시 시도해 주십시오.' }),
      { enableHighAccuracy:true, timeout, maximumAge:0 }
    );
  });
}
