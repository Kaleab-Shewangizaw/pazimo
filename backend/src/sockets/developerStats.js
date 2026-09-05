const jwt = require('jsonwebtoken');
const Developer = require('../models/Developer');
const { collectStats } = require('../utils/serverStats');
const { logEmitter } = require('../utils/requestLog');

const ROOM = 'developer-stats';
const PUSH_INTERVAL_MS = 5000;

function registerDeveloperStatsNamespace(io) {
  const nsp = io.of('/developer-stats');

  // Runs before "connection" - rejects the socket entirely (not just a room
  // join) if the JWT is missing/invalid or doesn't belong to an active
  // Developer account. Mirrors findAccountByPayload's "always re-fetch from
  // the DB, never trust the token's role claim alone" discipline used for
  // every REST auth path in this app.
  nsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role !== 'developer') {
        return next(new Error('Forbidden'));
      }

      const developer = await Developer.findById(payload.id);
      if (!developer || developer.isActive === false) {
        return next(new Error('Forbidden'));
      }

      socket.developerId = developer._id.toString();
      next();
    } catch (err) {
      next(new Error('Authentication required'));
    }
  });

  nsp.on('connection', (socket) => {
    socket.join(ROOM);
  });

  // Only sample/broadcast while at least one developer dashboard is open,
  // so an idle server doesn't pay the systeminformation sampling cost forever.
  setInterval(async () => {
    const room = nsp.adapter.rooms.get(ROOM);
    if (!room || room.size === 0) return;

    try {
      const stats = await collectStats();
      nsp.to(ROOM).emit('stats', stats);
    } catch (err) {
      console.error('developerStats collection failed:', err.message);
    }
  }, PUSH_INTERVAL_MS);

  // Every app request re-broadcasts here in real time - only forward it when
  // a developer dashboard is actually connected, so an idle server doesn't
  // pay a per-request emit cost for nobody.
  logEmitter.on('log', (entry) => {
    const room = nsp.adapter.rooms.get(ROOM);
    if (!room || room.size === 0) return;
    nsp.to(ROOM).emit('log', entry);
  });

  return nsp;
}

module.exports = { registerDeveloperStatsNamespace };
