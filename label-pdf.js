// Address label builder. Needs jsPDF (UMD) loaded first.
//
// This is an address label, not prepaid postage — the customer pays at the
// counter. The wording says so plainly, because "postage label" reads as
// "already paid for" and that is an argument waiting to happen.
// buildLabelPdf(data) -> Promise<jsPDF>
//
// One A4 sheet with a cut-out label the customer tapes to the parcel. The job
// number is the point of it: a box with a number on it can be booked in
// straight away, a box without one sits on the bench while we work out whose
// it is.

const WORKSHOP = {
  name: 'Precision Electronics Repair',
  addr: ['262D Boundary Way', 'Watford', 'Hertfordshire', 'WD25 7SX'],
  phone: '07522 124273',
  email: 'info@precisionelectronicsrepair.co.uk'
};

const NAVY = [27, 42, 74];
const MUTED = [90, 100, 116];

// The logo lives next to the page, so it can just be fetched and embedded.
async function logoDataUrl() {
  try {
    const res = await fetch('logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

export async function buildLabelPdf(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const logo = await logoDataUrl();

  // ---- the label itself: 130mm x 100mm, centred near the top ----
  const LX = 40, LY = 30, LW = 130, LH = 100;

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.setLineDashPattern([2, 1.5], 0);
  doc.rect(LX - 4, LY - 4, LW + 8, LH + 8);
  doc.setLineDashPattern([], 0);

  doc.setDrawColor(210, 216, 224);
  doc.setLineWidth(0.3);
  doc.rect(LX, LY, LW, LH);

  // header band with the logo
  doc.setFillColor(...NAVY);
  doc.rect(LX, LY, LW, 20, 'F');

  if (logo) {
    try {
      // Keep the logo's proportions rather than squashing it into a box.
      const props = doc.getImageProperties(logo);
      const h = 13;
      const w = Math.min(60, (props.width / props.height) * h);
      doc.addImage(logo, 'PNG', LX + 5, LY + 3.5, w, h);
    } catch (e) {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('PRECISION ELECTRONICS REPAIR', LX + 5, LY + 12.5);
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PRECISION ELECTRONICS REPAIR', LX + 5, LY + 12.5);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('REPAIR — ADDRESS LABEL', LX + LW - 5, LY + 12.5, { align: 'right' });

  // The job number, boxed and shouting, because postage gets taped over things.
  const BX = LX + 6, BY = LY + 25, BW = LW - 12, BH = 26;

  doc.setFillColor(...NAVY);
  doc.rect(BX, BY, BW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DO NOT COVER — JOB NUMBER', BX + BW / 2, BY + 5, { align: 'center' });

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.rect(BX, BY, BW, BH);
  doc.setLineWidth(0.3);

  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(String(d.job_number || ''), BX + BW / 2, BY + 22, { align: 'center' });

  let y = BY + BH + 9;

  // send to
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('SEND TO', LX + 6, y);
  y += 6;

  doc.setTextColor(30, 39, 51);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(WORKSHOP.name, LX + 6, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  WORKSHOP.addr.forEach(line => { doc.text(line, LX + 6, y); y += 5.5; });

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(WORKSHOP.phone, LX + 6, y + 1);

  // Nothing about the customer goes on the outside of the parcel. The job
  // number identifies it, and their details travel inside on the packing slip.
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('RETURN DETAILS ON THE SLIP INSIDE', LX + LW - 6, LY + LH - 6, { align: 'right' });

  // ---- what to do with it, below the cut line ----
  let ny = LY + LH + 22;
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Sending your item in', 40, ny);
  ny += 8;

  doc.setTextColor(30, 39, 51);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const steps = [
    'Cut along the dashed line and tape the label to the outside of the parcel, address side up.',
    'Print page two, fill in anything it asks for, and put it inside the box with the item.',
    'Pack the item so nothing can move inside the box. Bubble wrap around the item, then padding around that.',
    'Include anything relevant — a power lead if the fault is charging, a controller if the fault is pairing.',
    'Take it to any Post Office or drop-off point and pay for postage there — this label is an address label, not prepaid postage. We suggest a tracked service, and keep your receipt.',
    'Back up your data first if the device holds any. We will not need your passcode unless we have asked for it.'
  ];

  steps.forEach((text, n) => {
    const lines = doc.splitTextToSize(text, 122);
    doc.setFont('helvetica', 'bold');
    doc.text(String(n + 1) + '.', 40, ny);
    doc.setFont('helvetica', 'normal');
    doc.text(lines, 46, ny);
    ny += lines.length * 4.6 + 2.5;
  });

  ny += 3;
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  const closing = d.battery_warning
    ? 'If the item has a lithium battery in it, tell the Post Office counter — batteries fitted inside a device are fine to post, loose batteries are not.'
    : 'If the item has a lithium battery fitted, that is fine to post inside the device. Loose batteries cannot be sent.';
  doc.text(doc.splitTextToSize(closing, 128), 40, ny);
  ny += 9;
  doc.text(doc.splitTextToSize(
    'Questions before you send it? Email ' + WORKSHOP.email + ' or call ' + WORKSHOP.phone + '.', 128), 40, ny);

  packingSlip(doc, d, logo);

  return doc;
}

// Page two: goes inside the box. Your name and address live here rather than
// on the outside, and it doubles as the list of what you put in.
function packingSlip(doc, d, logo) {
  doc.addPage();

  const L = 25, R = 185, W = R - L;

  // header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 30, 'F');
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const h = 14;
      const w = Math.min(62, (props.width / props.height) * h);
      doc.addImage(logo, 'PNG', L, 8, w, h);
    } catch (e) { /* fall through to the wordmark below */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PACKING SLIP', R, 17, { align: 'right' });

  let y = 46;

  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Put this slip inside the box', L, y);
  y += 7;

  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(doc.splitTextToSize(
    'It tells us whose parcel this is and where the item goes back to. Your name and address are ' +
    'deliberately not on the outside label.', W), L, y);
  y += 12;

  // job number
  doc.setFillColor(244, 246, 249);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.rect(L, y, W, 18, 'FD');
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text('JOB NUMBER', L + 5, y + 6);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(String(d.job_number || ''), L + 5, y + 14);

  if (d.item) {
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('ITEM', L + 80, y + 6);
    doc.setTextColor(30, 39, 51);
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(String(d.item), W - 86), L + 80, y + 13);
  }
  y += 26;

  // return address — the point of the slip
  const boxH = 46;
  doc.setDrawColor(210, 216, 224);
  doc.setLineWidth(0.3);
  doc.rect(L, y, W, boxH);
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text('RETURN TO — WHERE THE ITEM GOES BACK', L + 5, y + 7);

  let ay = y + 15;
  doc.setTextColor(30, 39, 51);

  if (d.customer_name) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(String(d.customer_name), L + 5, ay);
    ay += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    String(d.customer_address || '').split('\n').filter(Boolean).slice(0, 5).forEach(line => {
      doc.text(doc.splitTextToSize(line, W - 12), L + 5, ay);
      ay += 5.5;
    });
    if (!d.customer_address) {
      doc.setTextColor(...MUTED);
      doc.setFontSize(9);
      doc.text('Write your return address here:', L + 5, ay + 1);
      ay += 7;
      for (let i = 0; i < 3; i++) {
        doc.setDrawColor(210, 216, 224);
        doc.line(L + 5, ay, R - 5, ay);
        ay += 7;
      }
    }
  } else {
    doc.setTextColor(...MUTED);
    doc.setFontSize(9);
    doc.text('Write your name and return address here:', L + 5, ay - 2);
    ay += 4;
    for (let i = 0; i < 4; i++) {
      doc.setDrawColor(210, 216, 224);
      doc.line(L + 5, ay, R - 5, ay);
      ay += 7;
    }
  }
  y += boxH + 10;

  // the fault, in their own words, so the bench has it on paper
  if (d.fault) {
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('THE FAULT YOU REPORTED', L, y);
    y += 6;
    doc.setTextColor(30, 39, 51);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(String(d.fault), W);
    doc.text(lines, L, y);
    y += lines.length * 4.6 + 8;
  }

  // what's in the box
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text("What's in the box", L, y);
  y += 5;

  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Tick what you have packed. We check this off when the parcel arrives and again before it goes back.', L, y + 4);
  y += 12;

  // Anything they already told us is listed; the blanks are for the rest.
  const packed = [String(d.item || 'The item')];
  String(d.accessories || '').split(/[,\n]/).map(t => t.trim()).filter(Boolean).forEach(a => packed.push(a));
  while (packed.length < 6) packed.push('');

  packed.slice(0, 8).forEach(text => {
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.4);
    doc.rect(L, y - 3.4, 4.5, 4.5);
    if (text) {
      doc.setTextColor(30, 39, 51);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(doc.splitTextToSize(text, W - 12), L + 8, y);
    } else {
      doc.setDrawColor(224, 228, 234);
      doc.setLineWidth(0.3);
      doc.line(L + 8, y + 1, R, y + 1);
    }
    y += 9;
  });

  y += 4;
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(
    'Anything you send that is not on this list may not be recorded, so please write it in above. ' +
    'Please keep hold of SIM cards, memory cards and cases unless the fault is with them.', W), L, y);
  y += 14;

  doc.setDrawColor(210, 216, 224);
  doc.setLineWidth(0.3);
  doc.line(L, y, R, y);
  y += 8;

  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text(WORKSHOP.name + ' · ' + WORKSHOP.phone + ' · ' + WORKSHOP.email, L, y);
  doc.text('Track your repair any time using the link in your email.', L, y + 5);
}
