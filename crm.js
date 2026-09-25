// Shared helpers for the workshop software
import { createClient } from './vendor/supabase-js.min.js';
import './alert.js';

export const SUPABASE_URL = 'https://eazzljgezdownmcddeyr.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Tk5nuWw8LkpIb73ttPIlBw_zdT567D6';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export const $ = id => document.getElementById(id);

export function show(el, text, kind) { el.textContent = text; el.className = 'msg show ' + kind; }
export function hide(el) { el.className = 'msg'; }

export function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function when(ts) {
  return ts ? new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export function money(n) { return '£' + Number(n || 0).toFixed(2); }

export function ukNumber(raw) {
  const digits = String(raw || '').replace(/[^0-9+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('44')) return digits;
  if (digits.startsWith('0')) return '44' + digits.slice(1);
  return digits;
}

// On a computer, hand the message to the WhatsApp desktop app.
// On a phone, wa.me opens the app anyway.
export const onPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const waTarget = onPhone ? '_blank' : '_self';

export function waLink(phone, message) {
  const num = ukNumber(phone);
  const text = encodeURIComponent(message || '');
  if (onPhone) return 'https://wa.me/' + (num || '') + '?text=' + text;
  return 'whatsapp://send?' + (num ? 'phone=' + num + '&' : '') + 'text=' + text;
}

// Header + tabs, shared by every page
export function chrome(active) {
  const tabs = [
    ['workshop.html', 'Jobs'],
    ['invoices.html', 'Invoices'],
    ['todo.html', 'To do'],
    ['contacts.html', 'Contacts'],
    ['leads.html', 'Leads'],
    ['parts.html', 'Parts'],
    ['stock.html', 'Stock'],
    ['diagnose.html', 'Diagnostic'],
    ['knowledge.html', 'Knowledge'],
    ['reports.html', 'Reports'],
    ['settings.html', 'Settings']
  ];
  document.body.insertAdjacentHTML('afterbegin', `
    <header><div class="wrap">
      <div class="brand">PRECISION ELECTRONICS REPAIR · WORKSHOP</div>
      <div class="who" id="who" style="display:none">
        <a id="timerPill" href="#" title="A job timer is running"
           style="display:none;color:#fff;text-decoration:none;font-weight:700;background:#b3261e;border-radius:6px;padding:5px 10px;font-variant-numeric:tabular-nums"></a>
        <a id="mailBtn" href="${GMAIL_INBOX}" target="_blank" rel="noopener" title="Open the business inbox"
           style="color:#fff;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.4);border-radius:6px;padding:4px 10px">Mail<span id="mailCount"
           style="display:none;background:#e5484d;color:#fff;border-radius:10px;min-width:20px;height:20px;padding:0 6px;font-size:12px;line-height:20px;text-align:center"></span></a>
        <span id="whoEmail"></span><button id="signOut">Sign out</button></div>
    </div></header>
    <nav class="tabs"><div class="wrap">
      ${tabs.map(([href, label]) => `<a href="${href}"${href === active ? ' class="on"' : ''}>${label}</a>`).join('')}
    </div></nav>`);

  $('signOut').addEventListener('click', async () => { await sb.auth.signOut(); location.href = 'workshop.html'; });
  collapsibleSections();
}

// Every section box (.card) that starts with a heading is collapsed when the
// page opens; click the heading to open or close it. Sections added later
// (e.g. after loading) are picked up too. Page-title boxes (h1) stay open.
function collapsibleSections() {
  const wire = card => {
    if (card.dataset.fold || card.tagName === 'DETAILS') return;
    const h = card.firstElementChild;
    if (!h || h.tagName !== 'H2') return;
    card.dataset.fold = '1';
    card.classList.add('foldable');
    h.classList.add('foldhead');
    h.setAttribute('role', 'button');
    h.tabIndex = 0;
    card.classList.add('folded');
    const toggle = () => card.classList.toggle('folded');
    h.addEventListener('click', toggle);
    h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  };
  const scan = () => document.querySelectorAll('.card').forEach(wire);
  const start = () => {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}

// Business inbox (info@). The unread count comes from a Google Apps Script in
// that Gmail account, which updates mail_status every minute.
const GMAIL_INBOX = 'https://mail.google.com/mail/?authuser=' + encodeURIComponent('info@precisionelectronicsrepair.co.uk') + '#inbox';
let mailTimer = null;
async function mailCheck() {
  const badge = $('mailCount'), btn = $('mailBtn');
  if (!badge) return;
  const { data } = await sb.from('mail_status').select('unread,synced_at').eq('id', 1).maybeSingle();
  if (!data || !data.synced_at) { badge.style.display = 'none'; return; }
  const stale = Date.now() - new Date(data.synced_at).getTime() > 10 * 60 * 1000;
  if (stale) {
    badge.textContent = '?'; badge.style.background = '#8a94a6'; badge.style.display = 'inline-block';
    btn.title = 'Unread count not updating since ' + new Date(data.synced_at).toLocaleString('en-GB') + ' — check the Apps Script';
  } else if (data.unread > 0) {
    badge.textContent = data.unread > 99 ? '99+' : String(data.unread);
    badge.style.background = '#e5484d'; badge.style.display = 'inline-block';
    btn.title = data.unread + ' unread in the business inbox';
  } else {
    badge.style.display = 'none'; btn.title = 'No unread email';
  }
}
// A job timer left running shows in the header on every page.
let runTick = null;
export async function timerCheck() {
  const pill = $('timerPill');
  if (!pill) return;
  const { data } = await sb.from('job_time').select('started_at, jobs(job_number)').is('stopped_at', null).maybeSingle();
  clearInterval(runTick);
  if (!data) { pill.style.display = 'none'; return; }
  const no = data.jobs?.job_number || '';
  pill.href = 'job.html?job=' + encodeURIComponent(no);
  const draw = () => {
    const s = Math.max(0, Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000));
    pill.textContent = '⏱ ' + no + ' ' + Math.floor(s / 3600) + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  draw(); runTick = setInterval(draw, 1000);
  pill.style.display = 'inline-block';
}

export function startMail() {
  if (mailTimer) return;
  mailCheck(); timerCheck();
  mailTimer = setInterval(() => { mailCheck(); timerCheck(); }, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { mailCheck(); timerCheck(); } });
}

// Returns the session, or sends you to the sign-in page
export async function requireSession() {
  const { data } = await sb.auth.getSession();
  if (!data.session) { location.href = 'workshop.html'; return null; }
  const who = $('who');
  if (who) { $('whoEmail').textContent = data.session.user.email; who.style.display = 'flex'; }
  startMail();
  return data.session;
}

// Under an assistant answer: which web pages it used, which library items, and
// Google's search suggestions (Google asks for these to be shown with web-grounded answers).
export function aiExtras(out) {
  const box = document.createElement('div');
  box.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;color:var(--muted);white-space:normal';
  const parts = [];
  if (out.web && out.web.length) {
    parts.push('<div style="font-weight:700;color:var(--navy);margin-bottom:4px">Searched the web — pages used:</div><ol style="margin:0 0 10px 18px;padding:0">' +
      out.web.map(w => `<li><a href="${esc(w.uri)}" target="_blank" rel="noopener">${esc(w.title)}</a></li>`).join('') + '</ol>');
  } else if (out.searched === false) {
    parts.push('<div style="margin-bottom:8px">Web search wasn\'t available for this answer — library and general knowledge only.</div>');
  }
  if (out.sources && out.sources.length) parts.push('<div style="margin-bottom:8px">Used from your library: ' + out.sources.map(esc).join(', ') + '</div>');
  box.innerHTML = parts.join('');
  if (out.search_html) {
    const g = document.createElement('div');
    g.innerHTML = out.search_html;
    box.appendChild(g);
  }
  return box;
}

// ---------- tidy display of assistant answers ----------
// Models sometimes write units as LaTeX ($20\,\text{V}$, \Omega). Turn that into plain text.
export function cleanMath(t) {
  const sym = { Omega: 'Ω', omega: 'ω', mu: 'µ', le: '≤', leq: '≤', ge: '≥', geq: '≥', sim: '~', approx: '≈',
    times: '×', pm: '±', to: '→', rightarrow: '→', leftarrow: '←', degree: '°', circ: '°', ohm: 'Ω', cdot: '·', infty: '∞', Delta: 'Δ' };
  return String(t || '')
    .replace(/\$\$([\s\S]+?)\$\$/g, '$1')
    .replace(/\$([^$\n]{1,120})\$/g, '$1')
    .replace(/\\(?:text|mathrm|mathbf|textbf|operatorname)\{([^}]*)\}/g, '$1')
    .replace(/\^\{?\\circ\}?/g, '°')
    .replace(/\\([A-Za-z]+)/g, (m, w) => sym[w] ?? m)
    .replace(/\\[,;:]/g, ' ').replace(/\\!/g, '').replace(/\\%/g, '%')
    .replace(/\{([^{}]*)\}/g, '$1');
}

let mdCss = false;
function addMdCss() {
  if (mdCss) return; mdCss = true;
  const st = document.createElement('style');
  st.textContent = `
  .ai-md { white-space: normal !important; font-size: 14px; line-height: 1.6; color: #1f2733; }
  .ai-md h3 { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: #fff; background: var(--navy);
    border-radius: 6px; padding: 6px 12px; margin: 20px 0 10px; }
  .ai-md h3:first-child { margin-top: 0; }
  .ai-md h4 { font-size: 14px; color: var(--navy); margin: 14px 0 6px; }
  .ai-md p { margin: 0 0 10px; }
  .ai-md ul, .ai-md ol { margin: 0 0 10px; padding-left: 22px; }
  .ai-md li { margin: 3px 0; }
  .ai-md li > ul { margin: 4px 0 6px; }
  .ai-md strong { color: var(--navy); }
  .ai-md code { background: #fff; border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; font-size: 13px; }
  .ai-md sup { font-size: 10px; color: var(--muted); }`;
  document.head.appendChild(st);
}

function inline(t) {
  return esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:)]|$)/g, '$1<em>$2</em>')
    .replace(/\[(\d+(?:[–,\-]\s?\d+)*)\]/g, '<sup>[$1]</sup>');
}

// A small, safe Markdown renderer (headings, bullets, numbered lists, bold) — text is escaped first.
export function mdToHtml(text) {
  addMdCss();
  const lines = cleanMath(text).replace(/\r/g, '').split('\n');
  const out = []; const stack = []; let para = [];
  const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const closeTo = (lvl) => { while (stack.length > lvl) out.push(stack.pop() === 'ol' ? '</li></ol>' : '</li></ul>'); };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushPara(); continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { flushPara(); closeTo(0); continue; }
    let m = line.match(/^\s*#{1,3}\s+(.*)$/) || line.match(/^\s*(\d+\.\s+[A-Z][A-Z0-9 /&'—–-]{5,}.*)$/);
    if (m && !/^\s*#{4,}/.test(line)) { flushPara(); closeTo(0); out.push('<h3>' + inline(m[1].replace(/\*\*/g, '')) + '</h3>'); continue; }
    m = line.match(/^\s*#{4,}\s+(.*)$/);
    if (m) { flushPara(); closeTo(0); out.push('<h4>' + inline(m[1].replace(/\*\*/g, '')) + '</h4>'); continue; }
    m = line.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
    if (m) {
      flushPara();
      const lvl = Math.min(3, Math.floor(m[1].replace(/\t/g, '  ').length / 2) + 1);
      const type = /\d/.test(m[2]) ? 'ol' : 'ul';
      if (stack.length < lvl) { while (stack.length < lvl) { out.push(type === 'ol' ? '<ol><li>' : '<ul><li>'); stack.push(type); } }
      else { closeTo(lvl); out.push('</li><li>'); }
      out.push(inline(m[3]));
      continue;
    }
    if (stack.length && /^\s{2,}/.test(raw)) { out.push(' ' + inline(line.trim())); continue; }
    closeTo(0); para.push(line.trim());
  }
  flushPara(); closeTo(0);
  return '<div class="ai-md">' + out.join('') + '</div>';
}
