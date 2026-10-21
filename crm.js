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
    ['contacts.html', 'Contacts'],
    ['parts.html', 'Parts'],
    ['tests.html', 'Tests'],
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
  autoHistory();
}

// Every page's section boxes (.card starting with an <h2>) become tabs, the same
// layout as the job page. Boxes side by side in the same place form one tab bar;
// only the chosen box shows. Page-title boxes (h1) and job-page <details> are left alone.
// The last tab used is remembered per page. A box the page hides (display:none) loses
// its tab.
function collapsibleSections() {
  const page = location.pathname.split('/').pop() || 'index';
  const groups = new Map();   // parent element -> { bar, cards: [], btns: [], cur }
  const labelOf = card => {
    const h = card.firstElementChild;
    const first = [...h.childNodes].filter(n => n.nodeType === 3 || !n.classList?.contains('muted')).map(n => n.textContent).join('').trim();
    return first || h.textContent.trim();
  };
  const hidden = card => card.style.display === 'none';
  const key = (g) => 'subtab:' + page + ':' + [...groups.keys()].indexOf(g.parent);

  function pick(g, i, remember) {
    g.cur = i;
    g.cards.forEach((c, k) => { c.classList.toggle('tabon', k === i); g.btns[k].classList.toggle('on', k === i); });
    if (remember) { try { localStorage.setItem(key(g), String(i)); } catch (e) {} }
  }

  function sync(g) {
    g.cards.forEach((c, k) => {
      const b = g.btns[k], vis = hidden(c) ? 'none' : '';
      if (b.style.display !== vis) b.style.display = vis;
      const want = labelOf(c);
      if (b.textContent !== want) b.textContent = want;
      g.wasHidden[k] = hidden(c);
    });
    g.seen = true;
    if (g.cur == null || hidden(g.cards[g.cur])) {
      const k = g.cards.findIndex(c => !hidden(c));
      if (k >= 0) pick(g, k, false);
    }
    g.bar.style.display = g.cards.filter(c => !hidden(c)).length > 1 ? '' : 'none';
  }

  function scan() {
    const cards = [...document.querySelectorAll('.card')].filter(c =>
      c.tagName !== 'DETAILS' && !c.dataset.tab && c.firstElementChild?.tagName === 'H2' &&
      !c.parentElement.closest('.card'));
    cards.forEach(card => {
      const parent = card.parentElement;
      let g = groups.get(parent);
      if (!g) {
        g = { parent, cards: [], btns: [], wasHidden: [], cur: null, seen: false };
        g.bar = document.createElement('nav');
        g.bar.className = 'subtabs';
        card.before(g.bar);
        groups.set(parent, g);
      }
      card.dataset.tab = '1';
      card.classList.add('subtab');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = labelOf(card);
      const idx = g.cards.length;
      b.addEventListener('click', () => pick(g, idx, true));
      card.addEventListener('showtab', () => { g.picked = true; pick(g, idx, true); });
      g.cards.push(card); g.btns.push(b); g.wasHidden.push(hidden(card));
      g.bar.appendChild(b);
      // first time this group gets a tab chosen: remembered one, else one marked data-tab-default, else first
      if (g.cur == null) {
        let saved = null; try { saved = localStorage.getItem(key(g)); } catch (e) {}
        setTimeout(() => {
          if (g.picked) return; g.picked = true;
          let k = saved != null && g.cards[+saved] && !hidden(g.cards[+saved]) ? +saved : -1;
          if (k < 0) k = g.cards.findIndex(c => c.hasAttribute('data-tab-default') && !hidden(c));
          if (k < 0) k = g.cards.findIndex(c => !hidden(c));
          if (k >= 0) pick(g, k, false);
          sync(g);
        }, 0);
      }
    });
    groups.forEach(sync);
  }

  const start = () => {
    document.body.classList.add('subtabbed');
    scan();
    new MutationObserver(recs => {
      if (recs.some(r => !(r.target.closest && r.target.closest('.subtabs')))) scan();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
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

// ---------- on-site billing (rates set on the Settings page) ----------
export const RATE_DEFAULTS = { callout_fee: 75, callout_includes_mins: 60, onsite_hourly: 50, onsite_block_mins: 15, unfixed_callout_pct: 50 };

export async function loadRates() {
  const { data } = await sb.from('business_settings').select('*').eq('id', 1).maybeSingle();
  const r = { ...RATE_DEFAULTS };
  if (data) Object.keys(RATE_DEFAULTS).forEach(k => { if (data[k] != null) r[k] = Number(data[k]); });
  return r;
}

const pounds = n => Math.round(n * 100) / 100;
const minsText = m => { const h = Math.floor(m / 60), r = m % 60; return [h ? h + 'h' : '', r || !h ? r + 'm' : ''].filter(Boolean).join(' '); };
const firstText = m => m === 60 ? 'first hour' : m % 60 === 0 ? `first ${m / 60} hours` : `first ${minsText(m)}`;

// One visit's time -> invoice lines. Any started block is charged as a full block.
export function visitLines(mins, fixed, rates, label = '') {
  const r = rates || RATE_DEFAULTS;
  const pre = label ? label + ': ' : '';
  if (fixed === false) {
    return [{ description: `${pre}On-site visit, unable to repair (${r.unfixed_callout_pct}% of callout)`, amount: pounds(r.callout_fee * r.unfixed_callout_pct / 100) }];
  }
  const m = Math.max(0, Math.round(Number(mins) || 0));
  const out = [{ description: `${pre}On-site callout, includes the ${firstText(r.callout_includes_mins)}` + (m ? ` (time on site ${minsText(m)})` : ''), amount: pounds(r.callout_fee) }];
  const blocks = Math.ceil(Math.max(0, m - r.callout_includes_mins) / r.onsite_block_mins);
  if (blocks) {
    const each = pounds(r.onsite_hourly * r.onsite_block_mins / 60);
    out.push({ description: `${pre}Further on-site labour: ${blocks} × ${r.onsite_block_mins} min at £${each.toFixed(2)} (£${Number(r.onsite_hourly).toFixed(2)}/hour)`, amount: pounds(blocks * each) });
  }
  return out;
}

// Minutes between arrived and finished, rounded down to whole minutes.
export function visitMins(v) {
  if (!v.arrived_at || !v.finished_at) return null;
  return Math.max(0, Math.floor((new Date(v.finished_at) - new Date(v.arrived_at)) / 60000));
}


// ---------- saved entries on text boxes ----------
// Every text box offers what's been typed in it before, from the database, so the same list
// shows on every device. Anything new you type is saved for next time.
// Common fields share one list across pages, topped up with what's already in jobs and parts.
const HIST_PAGE = (location.pathname.split('/').pop() || 'index.html');
const HIST_ALIAS = {
  'workshop.html#bt': 'type', 'job.html#ieType': 'type',
  'workshop.html#bm': 'model', 'job.html#ieModel': 'model', 'stock.html#cModel': 'model', 'stock.html#nModel': 'model',
  'workshop.html#bf': 'fault', 'stock.html#cFault': 'fault', 'stock.html#nFault': 'fault',
  'parts.html#pName': 'partname', 'parts.html#eName': 'partname', 'job.html#qPartsNote': 'partname',
  'parts.html#pNumber': 'partno', 'parts.html#eNumber': 'partno', 'stock.html#cPart': 'partno',
  'parts.html#pLoc': 'location', 'parts.html#eLoc': 'location',
  'tests.html#eApplies': 'partno'
};
// Never offered: one-off values (serials, stickers, job numbers), searches and readings.
const HIST_SKIP = /search|phone|email|serial|sticker|wsInput|^bs$|ieSerial|rBoard|rJob|^m_|^s[a-z0-9]{8}$/i;
const HIST_MAX = 300;

function histKey(el) {
  if (el.dataset.hist) return el.dataset.hist;
  const name = el.id || [...el.classList][0] || el.getAttribute('placeholder') || '';
  if (!name) return '';
  return HIST_ALIAS[HIST_PAGE + '#' + name] || (HIST_PAGE + '#' + name);
}

let SAVED = {};   // field -> values, most recently used first
let SEEDS = {};   // field -> values already in jobs / parts
let HIST_READY = null;

function refreshLists() { document.querySelectorAll('datalist[data-histkey]').forEach(dl => fillList(dl, dl.dataset.histkey)); }

async function histSave(key, val) {
  val = String(val || '').trim();
  if (!val || val.length > 200) return;
  SAVED[key] = [val, ...(SAVED[key] || []).filter(v => v.toLowerCase() !== val.toLowerCase())];
  refreshLists();
  await sb.rpc('remember_entry', { p_field: key, p_value: val });
}

function loadHistory() {
  if (HIST_READY) return HIST_READY;
  HIST_READY = (async () => {
    const { data: sess } = await sb.auth.getSession();
    if (!sess?.session) return;
    const uniq = arr => [...new Set(arr.map(v => String(v || '').trim()).filter(Boolean))];
    const [saved, { data: jobs }, { data: parts }] = await Promise.all([
      sb.from('saved_entries').select('field, value').order('last_used', { ascending: false }).limit(10000),
      sb.from('job_list').select('make_model, device_type, fault_description').order('created_at', { ascending: false }).limit(500),
      sb.from('parts_stock').select('name, part_number, location')
    ]);
    SAVED = {};
    (saved.data || []).forEach(r => (SAVED[r.field] = SAVED[r.field] || []).push(r.value));
    SEEDS = {
      model: uniq((jobs || []).map(j => j.make_model)),
      type: uniq([...(jobs || []).map(j => j.device_type), 'PCB', 'Laptop', 'Phone', 'Tablet', 'Games console', 'Controller', 'Desktop PC', 'Arcade machine']),
      fault: uniq((jobs || []).map(j => j.fault_description)).filter(v => v.length <= 120),
      partname: uniq((parts || []).map(p => p.name)),
      partno: uniq((parts || []).map(p => p.part_number)),
      location: uniq((parts || []).map(p => p.location))
    };
    refreshLists();
    // Anything the earlier version kept on this device moves into the database, then is cleared.
    if (!saved.error) {
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('hist:'));
        for (const k of keys) {
          const vals = JSON.parse(localStorage.getItem(k) || '[]').reverse();
          for (const v of vals) await sb.rpc('remember_entry', { p_field: k.slice(5), p_value: v });
          localStorage.removeItem(k);
        }
      } catch (e) {}
    }
  })();
  return HIST_READY;
}

function fillList(dl, key) {
  const seen = new Set(), out = [];
  [...(SAVED[key] || []), ...(SEEDS[key] || [])].forEach(v => { const k = v.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(v); } });
  dl.innerHTML = out.slice(0, HIST_MAX).map(v => `<option value="${esc(v)}"></option>`).join('');
}
function wireHistory(el) {
  if (el.dataset.histOn || el.hasAttribute('list') || el.dataset.nohist !== undefined) return;
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  if (type !== 'text' || el.getAttribute('inputmode') === 'decimal') return;
  const name = el.id || [...el.classList][0] || '';
  if (HIST_SKIP.test(name) || HIST_SKIP.test(el.getAttribute('placeholder') || '') || el.autocomplete === 'off') return;
  const key = histKey(el); if (!key) return;
  el.dataset.histOn = '1';
  const id = 'hist-' + key.replace(/[^a-z0-9]/gi, '_');
  let dl = document.getElementById(id);
  if (!dl) { dl = document.createElement('datalist'); dl.id = id; dl.dataset.histkey = key; document.body.appendChild(dl); fillList(dl, key); }
  el.setAttribute('list', id);
  el.setAttribute('autocomplete', 'off');
  el.addEventListener('change', () => histSave(key, el.value));
}
export function autoHistory() {
  const scan = root => (root.querySelectorAll ? root.querySelectorAll('input') : []).forEach(wireHistory);
  scan(document);
  loadHistory();
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_IN' && !Object.keys(SAVED).length) { HIST_READY = null; loadHistory(); } });
  new MutationObserver(recs => recs.forEach(r => r.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    if (n.tagName === 'INPUT') wireHistory(n); else scan(n);
  }))).observe(document.body, { childList: true, subtree: true });
}
