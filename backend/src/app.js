const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();
// const xss = require('xss-clean');
// const rateLimiter = require('express-rate-limit');
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
const shortUrlRoutes = require("./routes/shortUrlRoutes");
const rsvpRoutes = require("../routes/rsvp");
const qrTicketRoutes = require("./routes/tickets");
const santimPayRoutes = require("./routes/santimPayRoutes");
const paymentConfigRoutes = require("./routes/paymentConfigRoutes");
const {
  sendInvitationEmail,
} = require("./controllers/invitationEmailController");
const { sendSMS } = require("./utils/sms");

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    "https://pazimo.vercel.app",
    "https://www.pazimo.vercel.app",
    "https://pazimo-front-end.vercel.app",
    "https://www.pazimo-front-end.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "https://pazimo.com",
    "https://www.pazimo.com",
    "https://organizer.pazimo.com",
    "https://www.organizer.pazimo.com",
    "https://www.pazimo-organizer.vercel.app",
    "https://pazimo-organizer.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean), // Allow both frontend URLs and filter out undefined
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 600, // Cache preflight request for 10 minutes
};

// Middleware
app.use(cors(corsOptions));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
// app.use(xss());

// Rate limiting
// const limiter = rateLimiter({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
// });
// app.use(limiter);

// Debug middleware to log requests
app.use((req, res, next) => {
  // console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  // console.log('Headers:', req.headers);
  next();
});

// Mount routes
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
app.use("/api/short", shortUrlRoutes);
app.use("/api/rsvp", rsvpRoutes);
app.use("/api/config/payment", paymentConfigRoutes);
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

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  // console.log('404 Not Found:', req.method, req.path);
  res.status(StatusCodes.NOT_FOUND).json({
    message: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    message: err.message || "Something went wrong!",
  });
});

module.exports = app;
