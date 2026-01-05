/**
 * Downloads a high-quality QR code image from a data URI.
 * It renders the QR code onto a large canvas (2048x2048) with a white background
 * to ensure high resolution and readability.
 *
 * @param qrCodeDataUri - The base64 data URI of the QR code (SVG or Image).
 * @param filename - The name of the file to download (e.g., "ticket-123.png").
 */
export const downloadHighQualityQR = (
  qrCodeDataUri: string,
  filename: string
) => {
  if (!qrCodeDataUri) return;

  const img = new window.Image();
  img.crossOrigin = "Anonymous";
  img.src = qrCodeDataUri;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    // Set a large size for high quality (2048x2048)
    const size = 2048;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill white background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);

    // Draw image
    ctx.drawImage(img, 0, 0, size, size);

    // Convert to PNG
    const pngUrl = canvas.toDataURL("image/png");

    // Trigger download
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
};
