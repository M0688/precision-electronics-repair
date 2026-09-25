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
