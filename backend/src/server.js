const app = require('./app');
const connectDB = require('./config/database');
const { startTicketScheduler } = require('./utils/ticketScheduler');
require('dotenv').config();

// Connect to MongoDB
connectDB();

// Start ticket availability scheduler
startTicketScheduler();

const http = require('http');
const socketio = require('socket.io');

const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: '*', // Or your frontend URL
    methods: ['GET', 'POST']
  }
});

// Make io accessible in controllers
app.set('io', io);

// Socket.IO connection handler
io.on('connection', (socket) => {
  // console.log('Socket connected:', socket.id);

  socket.on('joinOrganizerRoom', (organizerId) => {
    const roomName = `organizer_${organizerId}`;
    socket.join(roomName);
    // console.log(`Socket ${socket.id} joined room ${roomName}`);
  });

  socket.on('disconnect', () => {
    // console.log('Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// Error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

server.listen(PORT, () => {
  // console.log(`Server is running on port ${PORT}`);
// console.log(`Test the API: http://localhost:${PORT}/api/test`);
});

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
}); 