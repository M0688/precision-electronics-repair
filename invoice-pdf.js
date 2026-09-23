// Shared invoice PDF builder. Needs jsPDF (UMD) loaded first.
// buildInvoicePdf(data) -> jsPDF document

const BUSINESS = {
  name: 'Precision Electronics Repair',
  addr: ['262D Boundary Way', 'Watford', 'WD25 7SX'],
  phone: '07522 124273',
  email: 'info@precisionelectronicsrepair.co.uk',
  site: 'precisionelectronicsrepair.co.uk',
  bank: { name: 'Mitchell Morris', sort: '04-29-09', account: '59881100' }
};

const NAVY = [27, 42, 74];
const MUTED = [90, 100, 116];

function money(n) {
  const v = Number(n) || 0;
  return (v < 0 ? '−£' : '£') + Math.abs(v).toFixed(2);
}

function ukDate(ts) {
  return new Date(ts || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// A receipt is the same document, headed differently: nothing left to pay.
export function buildReceiptPdf(d) {
  return buildInvoicePdf({ ...d, receipt: true, status: 'paid' });
}

export function buildInvoicePdf(d) {
  const receipt = d.receipt === true;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 18, R = 192;
  let y = 20;

  // header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(BUSINESS.name.toUpperCase(), L, 19);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(BUSINESS.site, R, 19, { align: 'right' });

  y = 48;
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(receipt ? 'RECEIPT' : 'INVOICE', L, y);

  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text(receipt ? 'Receipt number' : 'Invoice number', R - 45, y - 8);
  doc.text('Date', R - 45, y - 2);
  doc.text('Job', R - 45, y + 4);
  doc.setTextColor(30, 39, 51);
  doc.setFont('helvetica', 'bold');
  doc.text(String(receipt ? (d.receipt_number || d.invoice_number) : d.invoice_number), R, y - 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(ukDate(receipt ? (d.paid_at || d.issued_at) : d.issued_at), R, y - 2, { align: 'right' });
  doc.text(String(d.job_number), R, y + 4, { align: 'right' });

  // addresses
  y += 14;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text('FROM', L, y);
  doc.text('BILL TO', 110, y);
  y += 5;
  doc.setTextColor(30, 39, 51);
  doc.setFontSize(10);

  let yl = y, yr = y;
  doc.setFont('helvetica', 'bold');
  doc.text(BUSINESS.name, L, yl); yl += 5;
  doc.setFont('helvetica', 'normal');
  BUSINESS.addr.forEach(line => { doc.text(line, L, yl); yl += 5; });
  doc.text(BUSINESS.phone, L, yl); yl += 5;
  doc.text(BUSINESS.email, L, yl); yl += 5;

  doc.setFont('helvetica', 'bold');
  doc.text(String(d.customer_name || ''), 110, yr); yr += 5;
  doc.setFont('helvetica', 'normal');
  String(d.customer_address || '').split('\n').filter(Boolean).forEach(line => {
    doc.text(doc.splitTextToSize(line, 80), 110, yr); yr += 5;
  });

  y = Math.max(yl, yr) + 10;

  // table
  doc.setFillColor(...NAVY);
  doc.rect(L, y, R - L, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPTION', L + 4, y + 6);
  doc.text('AMOUNT', R - 4, y + 6, { align: 'right' });
  y += 9;

  doc.setTextColor(30, 39, 51);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setDrawColor(226, 230, 236);

  // One row per line when the job had several items priced separately.
  const rows = Array.isArray(d.lines) && d.lines.length
    ? d.lines
    : [{ description: d.description || '', amount: d.amount }];

  rows.forEach((r, n) => {
    const text = doc.splitTextToSize(String(r.description || ''), 120);
    const last = n === rows.length - 1;
    const showItem = last && d.item && rows.length === 1;
    const rowH = Math.max(14, text.length * 5 + 8 + (showItem ? 4 : 0));
    doc.rect(L, y, R - L, rowH);
    doc.text(text, L + 4, y + 7);
    if (showItem) {
      doc.setTextColor(...MUTED);
      doc.setFontSize(9);
      doc.text('Item: ' + d.item, L + 4, y + rowH - 4);
      doc.setTextColor(30, 39, 51);
      doc.setFontSize(10);
    }
    doc.text(money(r.amount), R - 4, y + 7, { align: 'right' });
    y += rowH;
  });
  y += 6;

  // total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(receipt ? 'TOTAL PAID' : 'TOTAL DUE', R - 50, y + 2);
  doc.setFontSize(16);
  doc.text(money(d.amount), R, y + 2, { align: 'right' });
  y += 12;

  if (d.status === 'paid' && !receipt) {
    doc.setTextColor(28, 107, 60);
    doc.setFontSize(12);
    doc.text('PAID' + (d.paid_at ? ' — ' + ukDate(d.paid_at) : ''), R, y, { align: 'right' });
    y += 8;
  }

  y += 6;
  doc.setDrawColor(226, 230, 236);
  doc.setFillColor(244, 246, 249);
  doc.rect(L, y, R - L, 34, 'FD');
  doc.setTextColor(...NAVY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(receipt ? 'Paid in full — thank you' : 'How to pay', L + 4, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 39, 51);
  doc.setFontSize(9.5);
  if (receipt) {
    doc.text(`Received ${money(d.amount)}${d.paid_method ? ' by ' + d.paid_method : ''}${d.paid_at ? ' on ' + ukDate(d.paid_at) : ''}.`, L + 4, y + 16);
    doc.text(`Against invoice ${d.invoice_number}. There is nothing further to pay.`, L + 4, y + 22);
    doc.text('Keep this receipt for your records and for any warranty claim.', L + 4, y + 28);
  } else {
    doc.text(`Bank transfer — ${BUSINESS.bank.name} · Sort code ${BUSINESS.bank.sort} · Account ${BUSINESS.bank.account}`, L + 4, y + 16);
    doc.text(`Please use ${d.invoice_number} as the payment reference.`, L + 4, y + 22);
    doc.text('We also accept cash on collection.', L + 4, y + 28);
  }
  y += 44;

  // footer
  doc.setTextColor(...MUTED);
  doc.setFontSize(8.5);
  if (!receipt) doc.text('Payment is due before the item is returned or collected.', L, y);
  doc.text(`Workmanship warranty for as long as you own the device. Parts warranty 6 months. Terms: ${BUSINESS.site}/terms.html`, L, y + 5);

  return doc;
}
