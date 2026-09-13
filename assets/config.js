/* ══════════════════════════════════════════════════════════
   노가다의신 · 환경 설정
   ──────────────────────────────────────────────────────────
   Firebase 연결 전에는 아래 값이 그대로 비어 있어도 됩니다.
   값이 비어 있으면 자동으로 [데모 모드]로 동작하며,
   모든 데이터가 브라우저(localStorage)에만 저장됩니다.

   실제 운영으로 전환하려면:
   1) Firebase 콘솔에서 프로젝트 생성
   2) 웹 앱 추가 후 나오는 설정값을 FIREBASE 안에 붙여넣기
   3) Authentication → 전화번호 로그인 사용 설정
   4) Firestore / Storage 생성 후 firestore.rules 적용
   ══════════════════════════════════════════════════════════ */

export const FIREBASE = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

/* 데모 모드 판정 — projectId 가 비어 있으면 데모 */
export const DEMO = !FIREBASE.projectId;

/* ── 역할 정의 ─────────────────────────────────────────── */
export const ROLES = {
  dev:      { key:'dev',      label:'개발자',   rank:4, home:'admin.html'  },
  lead:     { key:'lead',     label:'직영팀장', rank:3, home:'admin.html'  },
  worker:   { key:'worker',   label:'근로자',   rank:2, home:'worker.html' },
  seeker:   { key:'seeker',   label:'구직자',   rank:1, home:'index.html'  }
};

/* ── 현장 기본값 ───────────────────────────────────────── */
export const SITE_DEFAULT = {
  name: '제1현장',
  address: '',
  lat: 37.1893,          // 허용 반경 판정 기준 좌표
  lng: 126.9430,
  radius: 300,           // m
  workStart: '07:00',
  workEnd: '17:00'
};

/* ── 기준정보(요율·계수) 기본값 ────────────────────────────
   ※ 모든 값은 [기준정보] 화면에서 수정 가능합니다.
   ※ 법정 요율은 적용 시점 기준으로 반드시 확인 후 입력하십시오.
   ※ 정산 확정 시점의 요율은 기록에 함께 저장되어 소급 변경되지 않습니다.
   ───────────────────────────────────────────────────────── */
export const SETTINGS_DEFAULT = {
  hoursPerGongsu: 8,        // 1공수 기준 시간
  overtimeRate:   1.5,      // 연장 가산율
  nightRate:      0.5,      // 야간 가산(추가분)
  holidayRate:    1.5,      // 휴일 가산율
  mealAllowance:  10000,    // 식대(비과세)
  transAllowance: 0,        // 교통비(비과세)

  employmentIns:  0.009,    // 고용보험 근로자부담
  accidentIns:    0.0357,   // 산재보험(사업주 전액부담 · 표시용)
  pensionRate:    0.045,    // 국민연금 근로자부담
  healthRate:     0.03545,  // 건강보험 근로자부담
  ltCareRate:     0.1295,   // 장기요양(건강보험료 대비)
  pensionMinDays: 8,        // 월 출역 O일 이상이면 연금·건보 적용
  pensionMinHours:60,       // 또는 월 O시간 이상

  dayDeduction:   150000,   // 일용근로 근로소득공제(1일)
  incomeTaxRate:  0.06,     // 소득세율
  taxCreditRate:  0.55,     // 근로소득세액공제율
  localTaxRate:   0.10,     // 지방소득세(소득세 대비)
  minTaxLimit:    1000,     // 소액부징수 기준
  roundUnit:      10        // 원단위 절사
};

/* ── 직종별 단가 기본값 (원/1공수) ─────────────────────────
   현장 실제 단가로 반드시 교체하십시오. [기준정보]에서 수정.
   ───────────────────────────────────────────────────────── */
export const TRADES_DEFAULT = [
  { name:'보통인부',   rate:160000 },
  { name:'특별인부',   rate:190000 },
  { name:'형틀목공',   rate:250000 },
  { name:'건축목공',   rate:250000 },
  { name:'철근공',     rate:250000 },
  { name:'콘크리트공', rate:230000 },
  { name:'조적공',     rate:240000 },
  { name:'미장공',     rate:250000 },
  { name:'방수공',     rate:230000 },
  { name:'타일공',     rate:250000 },
  { name:'도장공',     rate:230000 },
  { name:'비계공',     rate:260000 },
  { name:'용접공',     rate:250000 },
  { name:'전기공',     rate:240000 },
  { name:'배관공',     rate:230000 },
  { name:'중장비운전', rate:280000 }
];

/* ── 제출 서류 항목 ────────────────────────────────────── */
export const DOC_TYPES = [
  { key:'id',        label:'신분증 사본',          required:true,  note:'주민등록번호 뒷자리는 가리고 촬영' },
  { key:'bank',      label:'통장 사본',            required:true,  note:'예금주가 본인과 일치해야 함' },
  { key:'safety',    label:'기초안전보건교육 이수증', required:true, note:'미제출 시 출역 제한' },
  { key:'contract',  label:'근로계약서',           required:true,  note:'서명본 촬영 업로드' },
  { key:'health',    label:'건강진단 결과서',       required:false, note:'해당 직종만' },
  { key:'license',   label:'자격증·면허',          required:false, note:'중장비·전기·용접 등' },
  { key:'foreign',   label:'외국인등록증·취업자격',  required:false, note:'외국인 근로자만' }
];

/* ── 서류 자동발송 수신처 ──────────────────────────────── */
export const MAIL = {
  to: '',                      // 회사 서류 접수 이메일
  mode: 'link',                // 'link' = 다운로드 링크 / 'attach' = 첨부
  digest: false                // true = 건별 대신 1일 1회 요약 발송
};

/* ── 게시판 구분 ───────────────────────────────────────── */
export const BOARDS = [
  { key:'notice', label:'공지사항', writeRole:'lead' },
  { key:'free',   label:'자유게시판', writeRole:'worker' },
  { key:'voice',  label:'건의사항', writeRole:'worker', anonymous:true }
];
