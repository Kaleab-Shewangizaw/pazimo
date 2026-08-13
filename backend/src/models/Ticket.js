const mongoose = require("mongoose");
const QRCode = require("qrcode");
const User = require("./User");
const fs = require("fs");
const path = require("path");

const {
  DEFAULT_COMMISSION_RATE,
  normalizeCommissionRate,
} = require("../config/rates");
function generateShortId() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const TicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      default: generateShortId,
      unique: true,
      required: true,
      index: true,
    },

    isInvitation: {
      type: Boolean,
      required: true,
      default: false,
    },

    isOnDoor: {
      type: Boolean,
      default: false,
    },

    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return !this.isInvitation && !this.isOnDoor;
      },
    },

    guestName: {
      type: String,
      required: function () {
        return this.isInvitation;
      },
    },

    guestEmail: {
      type: String,
    },

    guestPhone: {
      type: String,
    },

    ticketType: {
      type: String,
      required: function () {
        return !this.isInvitation;
      },
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // The commission rate this ticket was actually sold under, copied from the
    // event at creation time and never updated afterwards.
    //
    // Snapshotted for the same reason BeverageSale snapshots prices: an admin
    // renegotiating an event's rate must not retroactively revalue sales that
    // have already been counted, reported, and in many cases paid out. Absent
    // on tickets sold before per-event rates existed; readers fall back to the
    // 3% default (see utils/ticketRevenueQuery.COMMISSION_RATE_EXPR).
    commissionRate: {
      type: Number,
      min: 0,
    },

    currency: {
      type: String,
      enum: ["ETB", "USD"],
      default: "ETB",
      index: true,
    },

    purchaseDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: [
        "active",
        "used",
        "cancelled",
        "expired",
        "pending",
        "confirmed",
        "declined",
      ],
      default: this.isInvitation ? "pending" : "active",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },

    paymentDate: {
      type: Date,
    },

    ticketCount: {
      type: Number,
      default: 1,
    },

    purchaseQuantity: {
      type: Number,
      default: 1,
    },

    paymentReference: {
      type: String,
      index: true, 
    },

    invitationId: {
      type: String,
      sparse: true,
    },

    checkedIn: {
      type: Boolean,
      default: false,
    },

    checkedAt: {
      type: Date,
    },

    message: {
      type: String,
    },

    qrCode: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// ⚡ OPTIMIZED INDEXES for 2000+ attendee events
// Note: ticketId already has unique index from schema definition above

// Compound indexes (order matters - most selective first)
TicketSchema.index({ event: 1, status: 1, createdAt: -1 }); // Event tickets with status filter
TicketSchema.index({ event: 1, checkedIn: 1, status: 1 }); // QR scanning - checked in filter
TicketSchema.index({ event: 1, paymentStatus: 1, price: 1 }); // Revenue/stats calculations
TicketSchema.index({ event: 1, currency: 1, createdAt: -1 }); // Currency-specific analytics
TicketSchema.index({ event: 1, isInvitation: 1, createdAt: -1 }); // Invitation/event ticket listing
TicketSchema.index({ user: 1, createdAt: -1 }); // User ticket queries
TicketSchema.index({ user: 1, status: 1 }); // User active tickets
TicketSchema.index({ isInvitation: 1, paymentStatus: 1, status: 1 }); // Invitation stats
TicketSchema.index({ event: 1, isOnDoor: 1, createdAt: -1 }); // On-door vs online filter
TicketSchema.index({ invitationId: 1 }, { sparse: true }); // Direct invitation-to-ticket lookup
TicketSchema.index({ event: 1, isInvitation: 1, guestEmail: 1 }, { sparse: true }); // Legacy invitation matching
TicketSchema.index({ event: 1, isInvitation: 1, guestPhone: 1 }, { sparse: true }); // Legacy invitation matching
TicketSchema.index({ guestPhone: 1 }, { sparse: true }); // Guest ticket lookup
TicketSchema.index({ guestEmail: 1 }, { sparse: true }); // Guest ticket lookup
TicketSchema.index({ checkedIn: 1 }); // Fast filtering for check-in status
TicketSchema.index({ paymentReference: 1 }); // Payment lookup (already exists above)

// Snapshot the commission rate this ticket is being sold under.
//
// Done here rather than at each of the nine places that create tickets, so a
// new creation path cannot forget it. Runs once, on insert only: an existing
// ticket's rate is never rewritten, which is the whole point of the snapshot.
TicketSchema.pre("validate", async function snapshotCommissionRate(next) {
  if (!this.isNew) return next();
  if (typeof this.commissionRate === "number") return next();
  if (!this.event) return next();

  try {
    // Required lazily to avoid a require cycle through the model registry.
    const EventModel = require("./Event");
    const event = await EventModel.findById(this.event)
      .select("commissionRate")
      .lean();
    this.commissionRate = normalizeCommissionRate(
      event?.commissionRate ?? DEFAULT_COMMISSION_RATE
    );
    next();
  } catch (error) {
    // A pricing lookup must never block a paid ticket from being issued. Fall
    // back to the default rate — the same figure the reader would have used.
    console.error("Commission rate snapshot failed, using default:", error.message);
    this.commissionRate = DEFAULT_COMMISSION_RATE;
    next();
  }
});

// QR images are no longer generated or stored here.
//
// This hook used to build a branded SVG and persist it as a base64 data URI on
// every ticket. It averaged 54 KB — 99% of the document — because the 26 KB
// Pazimo logo was base64'd into the SVG and the whole SVG base64'd again, once
// per ticket. At a million tickets that is ~50 GB of the same logo in the
// hottest collection, on a server with 11 GB of RAM.
//
// The payload is fully derived from fields already on this document, so the
// image is rendered on demand instead: see utils/qrRenderer.js, served by
// GET /api/tickets/:ticketId/qr.svg. Verified against every existing ticket —
// the re-rendered code carries the same ticketId, which is the only field the
// scanner reads (see validateQRCode).
//
// The old implementation is preserved below, disabled, until the backfill that
// strips stored qrCode values has run everywhere.
const LEGACY_QR_ON_SAVE = false;

TicketSchema.pre("save", async function (next) {
  if (!LEGACY_QR_ON_SAVE) return next();
  if (this.qrCode) return next();

  try {
    let userName = "";
    let guestName = "";
    let type = "user";

    if (this.isInvitation) {
      type = "guest";
      guestName = this.guestName;
    } else if (this.user) {
      // Fetch user details if not already populated
      if (this.user.firstName && this.user.lastName) {
        userName = `${this.user.firstName} ${this.user.lastName ? this.user.lastName : ""}`;
      } else {
        const user = await User.findById(this.user).select(
          "firstName lastName",
        );
        if (user) {
          userName = `${user.firstName} ${user.lastName ? user.lastName : ""}`;
        }
      }
    }

    const payload = JSON.stringify({
      tid: this.ticketId,
      nm: userName || guestName,
      tp: type,
      tip: this.ticketType,
      qty: this.purchaseQuantity,
    });

    // 1. Generate BASE SVG QR
    let svg = await QRCode.toString(payload, {
      errorCorrectionLevel: "H",
      type: "svg",
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // 2. Convert squares → circles
    svg = svg.replace(
      /<rect([^>]*)width="1" height="1"/g,
      '<circle$1 r="0.5" cx="0.5" cy="0.5"',
    );

    // 3. Load logo
    let logoPath = path.join(__dirname, "../../uploads/logo/miniLogo.png");
    if (!fs.existsSync(logoPath)) {
      logoPath = path.join(__dirname, "../../../frontend/public/logo.png");
    }

    let logoSvg = "";
    if (fs.existsSync(logoPath)) {
      const logoBase64 = fs.readFileSync(logoPath, "base64");

      const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
      const size = viewBox ? parseInt(viewBox[1]) : 41;

      // Logo size: ~20% of QR code
      const logoSize = size * 0.2;
      const center = size / 2;
      const x = center - logoSize / 2;
      const y = center - logoSize / 2;

      // White background padding (slightly larger than logo)
      const padding = 1;
      const bgSize = logoSize + padding * 2;
      const bgX = x - padding;
      const bgY = y - padding;

      logoSvg = `
        <!-- White background square (PADDING) -->
        <rect
          x="${bgX}"
          y="${bgY}"
          width="${bgSize}"
          height="${bgSize}"
          fill="white"
          rx="1" ry="1"
        />

        <!-- Logo (Square) -->
        <image
          x="${x}"
          y="${y}"
          width="${logoSize}"
          height="${logoSize}"
          href="data:image/png;base64,${logoBase64}"
          preserveAspectRatio="xMidYMid meet"
        />
      `;
    }

    // 4. Finder eye styling (blue rounded)
    svg = svg.replace(
      /<rect x="0" y="0" width="7" height="7"[^>]*>/g,
      `<rect x="0" y="0" width="7" height="7" rx="2" ry="2" fill="#115db1"/>`,
    );

    svg = svg.replace(
      /<rect x="1" y="1" width="5" height="5"[^>]*>/g,
      `<rect x="1" y="1" width="5" height="5" rx="1.5" ry="1.5" fill="white"/>`,
    );

    svg = svg.replace(
      /<rect x="2" y="2" width="3" height="3"[^>]*>/g,
      `<rect x="2" y="2" width="3" height="3" rx="1" ry="1" fill="#115db1"/>`,
    );

    // 5. Inject logo safely before </svg>
    svg = svg.replace("</svg>", `${logoSvg}</svg>`);

    // 6. Save as base64
    this.qrCode = `data:image/svg+xml;base64,${Buffer.from(svg).toString(
      "base64",
    )}`;

    next();
  } catch (err) {
    console.error("QR generation failed:", err);
    next(err);
  }
});

module.exports = mongoose.model("Ticket", TicketSchema);
