/* ══════════════════════════════════════════════════════════
   공수 계산 엔진
   ──────────────────────────────────────────────────────────
   웹·앱이 동일한 결과를 쓰도록 계산 로직을 이 파일 하나로 모음.
   추후 Cloud Functions 로 그대로 이전 가능 (외부 의존성 없음).
   ══════════════════════════════════════════════════════════ */

/** 원단위 절사 */
export function floorTo(n, unit = 10){
  return Math.floor(n / unit) * unit;
}

/** 숫자 → 천단위 콤마 */
export function won(n){
  return (Math.round(n) || 0).toLocaleString('ko-KR');
}

/** 공수 표기 (1.375공수) */
export function gs(n){
  return (Math.round(n * 1000) / 1000).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
}

/**
 * 하루치 공수·지급액 계산
 *
 * @param {object} p
 *  @param {number} p.unitRate       직종 단가 (원/1공수)
 *  @param {number} p.normalHours    정상 근로시간
 *  @param {number} p.overtimeHours  연장 근로시간
 *  @param {number} p.nightHours     야간 시간대(22~06) 근로시간
 *  @param {boolean} p.holiday       휴일 근로 여부
 *  @param {number} p.monthDays      당월 누적 출역일수(본일 포함)
 *  @param {number} p.monthHours     당월 누적 근로시간(본일 포함)
 *  @param {object} p.s              기준정보(SETTINGS)
 *  @param {boolean} p.allowance     비과세 수당 지급 여부 (기본 true)
 * @returns {object} 계산 명세
 */
export function calcDay(p){
  const s = p.s;
  const H = s.hoursPerGongsu || 8;
  const rate = Number(p.unitRate) || 0;

  const nH = Math.max(0, Number(p.normalHours)   || 0);
  const oH = Math.max(0, Number(p.overtimeHours) || 0);
  const gH = Math.max(0, Number(p.nightHours)    || 0);

  // 1) 공수 산출
  const hMul = p.holiday ? (s.holidayRate || 1.5) : 1;
  const normalGongsu   = (nH / H) * hMul;
  const overtimeGongsu = (oH / H) * (s.overtimeRate || 1.5) * hMul;
  const nightGongsu    = (gH / H) * (s.nightRate || 0.5);
  const totalGongsu    = normalGongsu + overtimeGongsu + nightGongsu;

  // 2) 기본노무비 (과세대상)
  const basePay = floorTo(rate * totalGongsu, s.roundUnit || 10);

  // 3) 비과세 수당
  const useAllow = p.allowance !== false;
  const meal  = useAllow && nH + oH > 0 ? (s.mealAllowance  || 0) : 0;
  const trans = useAllow && nH + oH > 0 ? (s.transAllowance || 0) : 0;
  const taxFree = meal + trans;

  const gross = basePay + taxFree;

  // 4) 공제
  const R = s.roundUnit || 10;

  // 고용보험 — 1일 근로에도 적용
  const employment = floorTo(basePay * (s.employmentIns || 0), R);

  // 국민연금·건강보험 — 월 8일 이상 또는 월 60시간 이상일 때 적용
  const days  = Number(p.monthDays)  || 0;
  const hours = Number(p.monthHours) || 0;
  const insuranceApplies =
        days  >= (s.pensionMinDays  || 8) ||
        hours >= (s.pensionMinHours || 60);

  const pension = insuranceApplies ? floorTo(basePay * (s.pensionRate || 0), R) : 0;
  const health  = insuranceApplies ? floorTo(basePay * (s.healthRate  || 0), R) : 0;
  const ltCare  = insuranceApplies ? floorTo(health  * (s.ltCareRate  || 0), R) : 0;

  // 일용근로소득세 — 분리과세, 소액부징수 적용
  const taxable = Math.max(0, basePay - (s.dayDeduction || 0));
  const rawTax  = taxable * (s.incomeTaxRate || 0) * (1 - (s.taxCreditRate || 0));
  const incomeTax = rawTax < (s.minTaxLimit || 0) ? 0 : floorTo(rawTax, R);
  const localTax  = incomeTax === 0 ? 0 : floorTo(incomeTax * (s.localTaxRate || 0), R);

  const deduction = employment + pension + health + ltCare + incomeTax + localTax;
  const net = gross - deduction;

  // 사업주 부담(표시용)
  const accident = floorTo(basePay * (s.accidentIns || 0), R);

  // 경고 — 연금·건보 적용 임박
  const warnings = [];
  if(!insuranceApplies && days === (s.pensionMinDays || 8) - 1){
    warnings.push(`당월 출역 ${days}일 — 1일 추가 시 국민연금·건강보험이 당월 전체에 소급 적용됨`);
  }
  if(insuranceApplies && days === (s.pensionMinDays || 8)){
    warnings.push(`당월 출역 ${days}일 도달 — 국민연금·건강보험 적용 개시(당월 소급)`);
  }

  return {
    gongsu: { normal:normalGongsu, overtime:overtimeGongsu, night:nightGongsu, total:totalGongsu },
    unitRate: rate,
    basePay, meal, trans, taxFree, gross,
    deductions: { employment, pension, health, ltCare, incomeTax, localTax, total:deduction },
    insuranceApplies, accident, net, warnings, holiday: !!p.holiday
  };
}

/**
 * 출퇴근 시각 → 정상/연장/야간 시간 분해
 * @param {string} start "07:00"
 * @param {string} end   "19:00"
 * @param {number} breakMin 휴게시간(분) 기본 60
 * @param {object} s 기준정보
 */
export function splitHours(start, end, breakMin = 60, s = {}){
  const H = s.hoursPerGongsu || 8;
  const toMin = t => {
    const [h,m] = String(t).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  let a = toMin(start), b = toMin(end);
  if(b <= a) b += 24 * 60;                       // 익일 퇴근

  let total = (b - a - (breakMin || 0)) / 60;
  if(total < 0) total = 0;

  const normal   = Math.min(total, H);
  const overtime = Math.max(0, total - H);

  // 야간(22:00~06:00) 구간 겹침 계산
  let night = 0;
  for(let d = 0; d <= 1; d++){
    const ns = 22 * 60 + d * 1440, ne = 30 * 60 + d * 1440; // 22:00 ~ 익일 06:00
    night += Math.max(0, Math.min(b, ne) - Math.max(a, ns));
  }
  night = Math.min(night / 60, total);

  return {
    total: round2(total),
    normal: round2(normal),
    overtime: round2(overtime),
    night: round2(night)
  };
}

function round2(n){ return Math.round(n * 100) / 100; }

/** 여러 명 일괄 계산 → 팀 합계 */
export function calcTeam(rows, s){
  const results = rows.map(r => ({ ...r, calc: calcDay({ ...r, s }) }));
  const sum = results.reduce((a, r) => ({
    gongsu: a.gongsu + r.calc.gongsu.total,
    gross:  a.gross  + r.calc.gross,
    deduction: a.deduction + r.calc.deductions.total,
    net:    a.net    + r.calc.net
  }), { gongsu:0, gross:0, deduction:0, net:0 });
  return { results, sum };
}

/** 두 좌표 간 거리(m) — 출퇴근 반경 판정 */
export function distanceM(lat1, lng1, lat2, lng2){
  const R = 6371000, rad = d => d * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng/2)**2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
