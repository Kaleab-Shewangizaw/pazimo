import QRCode from "qrcode";

const LOGO_SRC = "/mobile_logo.png";
// Fraction of the QR's module grid width the logo badge occupies. Squared,
// that's only ~8% of the total module area — well inside the ~30% damage
// budget error-correction level H gives us, so the code stays scannable.
const LOGO_FRACTION = 0.26;

let logoDataUrlPromise: Promise<string> | null = null;

// Fetched once and cached — every "Generate QR Code" click after the first
// reuses the same data URL instead of re-fetching/re-encoding the logo.
const loadLogoDataUrl = (): Promise<string> => {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(LOGO_SRC)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      );
  }
  return logoDataUrlPromise;
};

// Branded event-share QR: round (dot) modules with rounded square finder
// eyes, matching the look already used for ticket QR codes
// (backend/src/utils/qrRenderer.js) instead of the plain square modules
// `qrcode`'s default SVG/canvas renderers draw. The Pazimo mark sits in the
// center on a white badge, with the modules underneath it left blank.
export const generateDottedQrDataUrl = async (
  payload: string,
  color: string = "#0D47A1",
  withLogo: boolean = true
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

  const logoSize = size * LOGO_FRACTION;
  const logoStart = (size - logoSize) / 2;
  const logoEnd = logoStart + logoSize;
  const inLogoZone = (row: number, col: number) =>
    withLogo &&
    row >= logoStart &&
    row < logoEnd &&
    col >= logoStart &&
    col < logoEnd;

  let dots = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!modules.get(row, col) || inFinderEye(row, col) || inLogoZone(row, col))
        continue;
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

  let logo = "";
  if (withLogo) {
    const logoDataUrl = await loadLogoDataUrl();
    const pad = logoSize * 0.14;
    const badgeX = margin + logoStart - pad;
    const badgeY = margin + logoStart - pad;
    const badgeSize = logoSize + pad * 2;
    const clipId = "pazimo-qr-logo-clip";
    logo =
      `<rect x="${badgeX}" y="${badgeY}" width="${badgeSize}" height="${badgeSize}" rx="${badgeSize * 0.22}" fill="#FFFFFF"/>` +
      `<defs><clipPath id="${clipId}"><rect x="${margin + logoStart}" y="${margin + logoStart}" width="${logoSize}" height="${logoSize}" rx="${logoSize * 0.22}"/></clipPath></defs>` +
      `<image href="${logoDataUrl}" x="${margin + logoStart}" y="${margin + logoStart}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}">` +
    `<rect width="${viewBoxSize}" height="${viewBoxSize}" fill="#FFFFFF"/>` +
    dots +
    eyes +
    logo +
    `</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};
