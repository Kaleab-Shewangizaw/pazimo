const mongoose = require("mongoose");
const QRCode = require("qrcode");
const User = require("./User");
const fs = require("fs");
const path = require("path");

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

// Add compound index for efficient event ticket queries
TicketSchema.index({ event: 1, createdAt: -1 });

TicketSchema.pre("save", async function (next) {
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
