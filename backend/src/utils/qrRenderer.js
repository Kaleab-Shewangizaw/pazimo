const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

// Single source of truth for ticket QR rendering.
//
// These images used to be generated in a Ticket pre-save hook and stored on the
// document as a base64 data URI. That was costing ~54 KB per ticket — 99% of the
// document — because the Pazimo logo (26 KB) was base64'd into the SVG and then
// the whole SVG was base64'd again for the data URI. Every ticket carried its own
// copy of the same logo; at a million tickets that is ~50 GB of duplicated image
// in the hottest collection on an 11 GB server.
//
// The payload is fully derived from fields already on the ticket, so the image is
// deterministic and can be rendered on demand instead of stored. Nothing is
// persisted here.

const getLogoPath = () => {
  const candidates = [
    path.join(__dirname, "../../uploads/logo/miniLogo.png"),
    path.join(__dirname, "../../../frontend/public/logo.png"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
};

// Read and encode the logo once per process rather than once per ticket. Doing
// this per ticket, and persisting the result, is exactly what made the stored
// QR field 54 KB.
let cachedLogo;
const getLogoBase64 = () => {
  if (cachedLogo !== undefined) return cachedLogo;
  const found = getLogoPath();
  cachedLogo = found ? fs.readFileSync(found, "base64") : null;
  return cachedLogo;
};

// What the scanner reads. Just the ticket's own id — validateQRCode looks
// everything else up server-side (name, ticket type, quantity, status), so
// none of it needs to ride along in the code itself. Kept minimal on purpose:
// the more that's embedded, the denser the printed pattern gets, and cinema's
// own QR (utils in cinemaTicketController.js) has always been this small.
// Re-rendering an old ticket still produces a scannable code — validateQRCode
// only ever read `tid`/`ticketId`, so shedding the other fields breaks
// nothing already issued.
const buildTicketQrPayload = (ticket) => JSON.stringify({ tid: ticket.ticketId });

// The branded SVG: round (dot) modules, blue rounded finder eyes, logo in the
// middle.
//
// QRCode.toString's "svg" renderer draws every module as one combined <path>
// per color rather than one <rect> per module (see node_modules/qrcode/lib/
// renderer/svg.js) — there is no per-module element to reshape. This builds
// the SVG from the raw module matrix instead (QRCode.create), so each dark
// module can be its own <circle>.
const renderQrSvg = async (payload) => {
  const margin = 2;
  const qrData = QRCode.create(payload, { errorCorrectionLevel: "H" });
  const modules = qrData.modules;
  const size = modules.size;
  const viewBoxSize = size + margin * 2;

  // The three 7x7 finder squares — always at these three corners regardless
  // of payload — are drawn as their own rounded shapes below rather than as
  // dots, so skip them here.
  const inFinderEye = (row, col) =>
    (row < 7 && col < 7) ||
    (row < 7 && col >= size - 7) ||
    (row >= size - 7 && col < 7);

  let dots = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!modules.get(row, col) || inFinderEye(row, col)) continue;
      dots += `<circle cx="${col + margin + 0.5}" cy="${row + margin + 0.5}" r="0.5" fill="#000000"/>`;
    }
  }

  const eye = (x, y) =>
    `<rect x="${x}" y="${y}" width="7" height="7" rx="2" ry="2" fill="#115db1"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.5" ry="1.5" fill="white"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="1" ry="1" fill="#115db1"/>`;
  const eyes =
    eye(margin, margin) +
    eye(margin + size - 7, margin) +
    eye(margin, margin + size - 7);

  let svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}">` +
    `<rect width="${viewBoxSize}" height="${viewBoxSize}" fill="#FFFFFF"/>` +
    dots +
    eyes;

  const logoBase64 = getLogoBase64();
  if (logoBase64) {
    const logoSize = viewBoxSize * 0.2;
    const center = viewBoxSize / 2;
    const x = center - logoSize / 2;
    const y = center - logoSize / 2;
    const padding = 1;
    const bgSize = logoSize + padding * 2;

    svg +=
      `<rect x="${x - padding}" y="${y - padding}" width="${bgSize}" height="${bgSize}" fill="white" rx="1" ry="1"/>` +
      `<image x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" href="data:image/png;base64,${logoBase64}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  svg += "</svg>";
  return svg;
};

// Convenience for a ticket document: payload -> SVG in one call.
const renderTicketQrSvg = async (ticket) => renderQrSvg(buildTicketQrPayload(ticket));

// The legacy data-URI form. Kept only so anything still expecting the old shape
// keeps working during the transition — do not persist the result.
const renderTicketQrDataUri = async (ticket) => {
  const svg = await renderTicketQrSvg(ticket);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

// Raster form, for download and for email attachment. Same treatment the
// confirmation email has always used — the logo composited on a white circular
// backdrop so it stays legible against the dark modules.
// The logo-on-white-circle overlay is identical for every ticket at a given
// width — only the QR modules differ. Building it per request cost ~375 ms of
// blocking CPU, which on a single-threaded event loop stalls every other
// request. Build it once per width and keep it.
const backdropCache = new Map();
const getBackdrop = async (qrWidth) => {
  if (backdropCache.has(qrWidth)) return backdropCache.get(qrWidth);

  const logoPath = getLogoPath();
  if (!logoPath) {
    backdropCache.set(qrWidth, null);
    return null;
  }

  const { Jimp } = require("jimp");
  const logoImage = await Jimp.read(logoPath);
  const logoSize = Math.round(qrWidth * 0.22);
  logoImage.resize({ w: logoSize, h: logoSize });

  const padding = Math.round(logoSize * 0.22);
  const size = logoSize + padding * 2;
  const backdrop = new Jimp({ width: size, height: size, color: 0xffffffff });
  backdrop.circle();
  backdrop.composite(logoImage, padding, padding);

  const entry = { backdrop, size };
  backdropCache.set(qrWidth, entry);
  return entry;
};

const renderQrPng = async (payload, width = 400) => {
  const qrBuffer = await QRCode.toBuffer(payload, {
    errorCorrectionLevel: "H", // high correction tolerates the logo overlay
    type: "png",
    margin: 1,
    width,
  });

  const cached = await getBackdrop(width);
  if (!cached) return qrBuffer;

  // Required lazily — jimp is heavy and only the PNG path needs it, so the SVG
  // path (which serves every page view) doesn't pay for loading it.
  const { Jimp } = require("jimp");
  const qrImage = await Jimp.read(qrBuffer);

  // clone(), because composite mutates and the backdrop is shared.
  const offset = Math.round((qrImage.bitmap.width - cached.size) / 2);
  qrImage.composite(cached.backdrop.clone(), offset, offset);

  return qrImage.getBuffer("image/png");
};

const renderTicketQrPng = async (ticket, width) =>
  renderQrPng(buildTicketQrPayload(ticket), width);

module.exports = {
  getLogoPath,
  getLogoBase64,
  buildTicketQrPayload,
  renderQrSvg,
  renderQrPng,
  renderTicketQrSvg,
  renderTicketQrPng,
  renderTicketQrDataUri,
};
