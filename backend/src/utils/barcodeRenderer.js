const bwipjs = require("bwip-js");

// Barcode rendering for a refill sale's pickup code — `qrRenderer.js`'s
// counterpart for the "give them a barcode" flow rather than a QR code.
//
// Code128 rather than a QR: this is a 6-character alphanumeric code (see
// utils/referenceCode.js), and a linear barcode reads that shape naturally at
// a bar or counter scanner the way a QR does for a URL-shaped ticket id.
// `includetext` prints the code under the bars, so it stays usable when a
// scanner isn't at hand and the code is read off by eye instead.
//
// Nothing here is stored — deterministic and rendered on demand, same
// reasoning as the ticket QR it sits alongside.
async function renderBarcodePng(text, { scale = 3 } = {}) {
  return bwipjs.toBuffer({
    bcid: "code128",
    text,
    scale,
    height: 12,
    includetext: true,
    textxalign: "center",
  });
}

module.exports = { renderBarcodePng };
