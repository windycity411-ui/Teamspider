/* ══════════════════════════════════════════════════════════
   팀 스파이더 · 서류 자동발송 Cloud Function
   ──────────────────────────────────────────────────────────
   배포
     cd functions && npm install
     firebase deploy --only functions

   발송키 등록 (배포 전 1회)
     firebase functions:secrets:set MAIL_API_KEY
     firebase functions:secrets:set MAIL_FROM

   ※ 클라우드에서는 SMTP 직결이 차단되는 경우가 있어 메일 API 방식을 씁니다.
     기본은 Resend(https://resend.com) — 무료 한도로 1단계 운영에 충분합니다.
   ══════════════════════════════════════════════════════════ */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

const MAIL_API_KEY = defineSecret('MAIL_API_KEY');   // Resend API 키
const MAIL_FROM    = defineSecret('MAIL_FROM');      // 예: 팀스파이더 <noreply@회사도메인>

/* 호출을 허용할 도메인 — 배포한 주소로 반드시 바꾸십시오 */
const ALLOWED = [
  'https://windycity411-ui.github.io',
  'http://localhost:8080',
  'http://localhost:3000'
];

exports.sendDocumentMail = onRequest(
  { region: 'asia-northeast3', secrets: [MAIL_API_KEY, MAIL_FROM], cors: ALLOWED, maxInstances: 5 },
  async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { to, subject, body, files = [], mode = 'link' } = req.body || {};
    if (!to || !subject) return res.status(400).json({ error: 'to, subject 필요' });

    // 아주 단순한 형식 검증 — 임의 주소로의 대량 발송 방지
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return res.status(400).json({ error: '수신 주소 형식 오류' });
    }

    const links = files
      .filter(f => f && f.url)
      .map(f => `<li><a href="${escapeHtml(f.url)}">${escapeHtml(f.fileName || '첨부')}</a></li>`)
      .join('');

    const html = `
      <div style="font-family:system-ui,'Apple SD Gothic Neo',sans-serif;font-size:14px;line-height:1.7;color:#0D141A">
        <pre style="font-family:inherit;white-space:pre-wrap;margin:0 0 14px">${escapeHtml(body || '')}</pre>
        ${links ? `<p style="margin:0 0 6px;font-weight:700">첨부</p><ul style="margin:0 0 14px">${links}</ul>` : ''}
        <hr style="border:0;border-top:1px solid #C8D1D6;margin:18px 0">
        <p style="font-size:12px;color:#7C8992;margin:0">팀 스파이더 자동발송 · 회신하지 마십시오.</p>
      </div>`;

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MAIL_API_KEY.value()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from: MAIL_FROM.value(), to: [to], subject, html })
      });

      if (!r.ok) {
        const detail = await r.text();
        logger.error('mail send failed', { status: r.status, detail });
        return res.status(502).json({ error: '메일 발송 실패', status: r.status });
      }
      logger.info('mail sent', { to, subject, attachments: files.length, mode });
      return res.json({ ok: true });
    } catch (e) {
      logger.error('mail send error', e);
      return res.status(500).json({ error: '발송 중 오류' });
    }
  }
);

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
