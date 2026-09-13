// FIRST, before any router is built: teaches Express 4 to route a rejected
// promise from an async handler into the error middleware at the bottom of this
// file. Without it every `throw new BadRequestError(...)` in the controllers
// hangs the request instead of answering it. See middlewares/asyncErrors.js.
require("./middlewares/asyncErrors");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();
const { StatusCodes } = require("http-status-codes");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const eventRoutes = require("./routes/eventRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const organizerRoutes = require("./routes/organizerRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const contactRoutes = require("./routes/contactRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const invitationRoutes = require("./routes/invitationRoutes");
const campaignRoutes = require("./routes/campaigns");
const invitationPricingRoutes = require("./routes/invitationPricingRoutes");
const campaignPricingRoutes = require("./routes/campaignPricingRoutes");
const shortUrlRoutes = require("./routes/shortUrlRoutes");
const rsvpRoutes = require("./routes/rsvp");
const qrTicketRoutes = require("./routes/tickets");
const santimPayRoutes = require("./routes/santimPayRoutes");
const paymentConfigRoutes = require("./routes/paymentConfigRoutes");
const capitalRoutes = require("./routes/capitalRoutes");
const beverageRoutes = require("./routes/beverageRoutes");
const venueRoutes = require("./routes/venueRoutes");
const cinemaRoutes = require("./routes/cinemaRoutes");
const ticketShareRoutes = require("./routes/ticketShareRoutes");
const beverageShareRoutes = require("./routes/beverageShareRoutes");
const usherRoutes = require("./routes/usherRoutes");
const { sendInvitationEmail } = require("./controllers/invitationEmailController");
const { sendSMS } = require("./utils/sms");

const app = express();

// Trust the first hop (reverse proxy / load balancer) so req.ip reflects the
// real client address instead of the proxy's — required for per-IP rate
// limiting to work correctly in production. Adjust the hop count if your
// deployment adds more than one proxy layer in front of Node (e.g. CDN + LB).
app.set("trust proxy", 1);

// ------------------- CORS ------------------- //
const normalizeOrigin = (value) => {
  if (!value || typeof value !== "string") return null;
  return value.trim().replace(/\/$/, "");
};

const parseOriginList = (value) =>
  (value || "")
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);

const allowedOrigins = new Set(
  [
    "https://pazimo.com",
    "https://www.pazimo.com",
    "http://pazimo.com",
    "http://www.pazimo.com",
    "https://pazimo-ktzi.vercel.app",
    "https://www.pazimo-ktzi.vercel.app",
    "https://pazimo.vercel.app",
    "https://www.pazimo.vercel.app",
    "https://pazimo-front-end.vercel.app",
    "https://www.pazimo-front-end.vercel.app",
    "https://pazimo-organizer.vercel.app",
    "https://www.pazimo-organizer.vercel.app",
    "http://localhost:3000",
    ...parseOriginList(process.env.FRONTEND_URL),
    ...parseOriginList(process.env.CORS_ORIGIN),
    ...parseOriginList(process.env.CORS_ORIGINS),
  ]
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)
);

const isAllowedOrigin = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return true;

  if (allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  if (/^https?:\/\/(.+\.)?pazimo\.com$/i.test(normalizedOrigin)) {
    return true;
  }

  return /^http:\/\/localhost:\d+$/i.test(normalizedOrigin);
};

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests (Postman, curl)

    if (isAllowedOrigin(origin)) {
      callback(null, true); // 
    } else {
      console.log("Blocked CORS request from:", origin);
      callback(new Error("CORS not allowed by server")); 
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 600,
};

// Apply CORS middleware globally
app.use(cors(corsOptions));

// Handle preflight OPTIONS requests for all routes
app.options("*", cors(corsOptions));

// ------------------- Middleware ------------------- //
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Debug middleware to log requests (optional)
// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
//   console.log('Headers:', req.headers);
//   next();
// });

// ------------------- Routes ------------------- //
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/organizers", organizerRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/invitation-pricing", invitationPricingRoutes);
app.use("/api/campaign-pricing", campaignPricingRoutes);
app.use("/api/short", shortUrlRoutes);
app.use("/api/rsvp", rsvpRoutes);
app.use("/api/config/payment", paymentConfigRoutes);
app.use("/api/capital", capitalRoutes);
app.use("/api/beverages", beverageRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/cinemas", cinemaRoutes);
app.use("/api/ticket-shares", ticketShareRoutes);
app.use("/api/beverage-shares", beverageShareRoutes);
app.use("/api/ushers", usherRoutes);
app.use("/api/qr-tickets", qrTicketRoutes);
app.use("/", santimPayRoutes);

// Email route
app.post("/api/send-invitation-email", sendInvitationEmail);

// SMS route
app.post("/api/send-sms", async (req, res) => {
  try {
    const { phone, message } = req.body;
    const result = await sendSMS(phone, message);

    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("SMS send error:", error);
    res.status(500).json({ success: false, error: "Failed to send SMS" });
  }
});

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working!" });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    message: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error details for debugging
  console.error("=".repeat(60));
  console.error("❌ ERROR CAUGHT BY MIDDLEWARE:");
  console.error("Path:", req.method, req.path);
  console.error("Error Name:", err.name);
  console.error("Error Message:", err.message);
  console.error("Stack Trace:", err.stack);
  console.error("=".repeat(60));
  
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    message: err.message || "Something went wrong!",
    ...(err.code && { code: err.code }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
