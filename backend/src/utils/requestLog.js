const { EventEmitter } = require('events');

const MAX_LOGS = 300;
const buffer = [];
const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(20);

// IPv4-mapped IPv6 (::ffff:1.2.3.4) reads noisier than the plain v4 form -
// this is purely for display, the raw req.ip is still what gets stored.
const stripIpv6Prefix = (ip) => (ip || '').replace(/^::ffff:/, '');

// req.ip reflects the real client (not the reverse proxy) because
// app.set('trust proxy', 1) is already configured in app.js.
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const entry = {
      id: `${start}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ip: stripIpv6Prefix(req.ip),
      durationMs: Date.now() - start,
    };

    buffer.push(entry);
    if (buffer.length > MAX_LOGS) buffer.shift();
    logEmitter.emit('log', entry);
  });
  next();
}

function getRecentLogs(limit = 100) {
  return buffer.slice(-limit).reverse();
}

module.exports = { requestLogger, getRecentLogs, logEmitter };
