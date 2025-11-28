const app = require("./app");
const connectDB = require("./config/database");
const { startTicketScheduler } = require("./utils/ticketScheduler");
const http = require("http");
const socketio = require("socket.io");
require("dotenv").config();

const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*", // Or your frontend URL
    methods: ["GET", "POST"],
  },
});

// Make io accessible in controllers
app.set("io", io);

// Socket.IO connection handler
io.on("connection", (socket) => {
  // console.log('Socket connected:', socket.id);

  socket.on("joinOrganizerRoom", (organizerId) => {
    const roomName = `organizer_${organizerId}`;
    socket.join(roomName);
    // console.log(`Socket ${socket.id} joined room ${roomName}`);
  });

  socket.on("disconnect", () => {
    // console.log('Socket disconnected:', socket.id);
  });
});

// Connect to MongoDB and start server
connectDB().then(() => {
  // Start ticket availability scheduler only after DB connection
  startTicketScheduler();

  const PORT = process.env.PORT || 5000;

  server.listen(PORT, () => {
    // console.log(`Server is running on port ${PORT}`);
    // console.log(`Test the API: http://localhost:${PORT}/api/test`);
  });
});

// Error handling for uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.error(err.name, err.message);
  process.exit(1);
});

// Error handling for unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! 💥 Shutting down...");
  console.error(err.name, err.message);
  if (server.listening) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});
