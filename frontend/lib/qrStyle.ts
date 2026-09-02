import QRCode from "qrcode";

// Branded event-share QR: round (dot) modules with rounded square finder
// eyes, matching the look already used for ticket QR codes
// (backend/src/utils/qrRenderer.js) instead of the plain square modules
// `qrcode`'s default SVG/canvas renderers draw.
export const generateDottedQrDataUrl = async (
  payload: string,
  color: string = "#0D47A1"
) => {
  const margin = 2;
  const qrData = QRCode.create(payload, { errorCorrectionLevel: "H" });
  const modules = qrData.modules;
  const size = modules.size;
  const viewBoxSize = size + margin * 2;

  const inFinderEye = (row: number, col: number) =>
    (row < 7 && col < 7) ||
    (row < 7 && col >= size - 7) ||
    (row >= size - 7 && col < 7);

  let dots = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!modules.get(row, col) || inFinderEye(row, col)) continue;
      dots += `<circle cx="${col + margin + 0.5}" cy="${row + margin + 0.5}" r="0.5" fill="${color}"/>`;
    }
  }

  const eye = (x: number, y: number) =>
    `<rect x="${x}" y="${y}" width="7" height="7" rx="2" ry="2" fill="${color}"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.5" ry="1.5" fill="white"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="1" ry="1" fill="${color}"/>`;
  const eyes =
    eye(margin, margin) +
    eye(margin + size - 7, margin) +
    eye(margin, margin + size - 7);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}">` +
    `<rect width="${viewBoxSize}" height="${viewBoxSize}" fill="#FFFFFF"/>` +
    dots +
    eyes +
    `</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};
