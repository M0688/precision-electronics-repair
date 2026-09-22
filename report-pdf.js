// Repair report PDF builder. Needs jsPDF (UMD) loaded first.
// buildReportPdf(data) -> jsPDF document

const BUSINESS = {
  name: 'Precision Electronics Repair',
  addr: ['262D Boundary Way', 'Watford', 'WD25 7SX'],
  phone: '07522 124273',
  email: 'info@precisionelectronicsrepair.co.uk',
  site: 'precisionelectronicsrepair.co.uk'
};

const NAVY = [27, 42, 74];
const MUTED = [90, 100, 116];
const INK = [30, 39, 51];

function ukDate(ts) {
  return new Date(ts || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function buildReportPdf(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 18, R = 192, W = R - L;
  const BOTTOM = 272;
  let y = 0;

  function header() {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(BUSINESS.name.toUpperCase(), L, 19);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(BUSINESS.site, R, 19, { align: 'right' });
  }

  function footer() {
    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`${BUSINESS.name} · ${BUSINESS.phone} · ${BUSINESS.email}`, L, 284);
      doc.text(`Page ${p} of ${pages}`, R, 284, { align: 'right' });
    }
  }

  function room(needed) {
    if (y + needed > BOTTOM) {
      doc.addPage();
      header();
      y = 46;
    }
  }

  function block(title, body) {
    if (!body) return;
    const lines = doc.splitTextToSize(String(body), W);
    room(14 + lines.length * 5);
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), L, y);
    y += 2;
    doc.setDrawColor(226, 230, 236);
    doc.line(L, y, R, y);
    y += 6;
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(lines, L, y);
    y += lines.length * 5 + 9;
  }

  header();

  y = 48;
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('REPAIR REPORT', L, y);

  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('Job number', R - 45, y - 8);
  doc.text('Report date', R - 45, y - 2);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.text(String(d.job_number || ''), R, y - 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(ukDate(), R, y - 2, { align: 'right' });

  // facts panel
  y += 10;
  const facts = [
    ['Customer', d.customer_name],
    ['Item', d.item],
    ['Serial / IMEI', d.serial],
    ['Received', d.received_at ? ukDate(d.received_at) : '']
  ].filter(f => f[1]);

  const panelH = facts.length * 6 + 10;
  doc.setDrawColor(226, 230, 236);
  doc.setFillColor(244, 246, 249);
  doc.rect(L, y, W, panelH, 'FD');
  let fy = y + 8;
  facts.forEach(([label, value]) => {
    doc.setTextColor(...MUTED);
    doc.setFontSize(9.5);
    doc.text(label, L + 4, fy);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(String(value), W - 44), L + 42, fy);
    doc.setFont('helvetica', 'normal');
    fy += 6;
  });
  y += panelH + 12;

  if (d.summary) {
    const lines = doc.splitTextToSize(String(d.summary), W - 8);
    room(lines.length * 5.5 + 16);
    doc.setFillColor(244, 246, 249);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.8);
    doc.rect(L, y, W, lines.length * 5.5 + 12, 'F');
    doc.line(L, y, L, y + lines.length * 5.5 + 12);
    doc.setLineWidth(0.2);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(lines, L + 5, y + 8);
    y += lines.length * 5.5 + 20;
  }

  block('The fault', d.fault);

  if (d.work) {
    const items = String(d.work).split('\n').map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    room(16 + items.length * 6);
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('WORK CARRIED OUT', L, y);
    y += 2;
    doc.setDrawColor(226, 230, 236);
    doc.line(L, y, R, y);
    y += 7;
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    items.forEach(it => {
      const lines = doc.splitTextToSize(it, W - 6);
      room(lines.length * 5 + 3);
      doc.setTextColor(...NAVY);
      doc.text('•', L, y);
      doc.setTextColor(...INK);
      doc.text(lines, L + 5, y);
      y += lines.length * 5 + 2;
    });
    y += 8;
  }

  block('Outcome', d.outcome);
  block('Worth knowing', d.notes);

  // warranty strip
  room(26);
  doc.setDrawColor(226, 230, 236);
  doc.setFillColor(244, 246, 249);
  doc.rect(L, y, W, 22, 'FD');
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Your warranty', L + 4, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...INK);
  doc.setFontSize(9.5);
  doc.text('Our workmanship on this repair is guaranteed for as long as you own the device.', L + 4, y + 14);
  doc.text(`Replacement parts are covered for 6 months. Full terms: ${BUSINESS.site}/terms.html`, L + 4, y + 19);

  footer();
  return doc;
}
