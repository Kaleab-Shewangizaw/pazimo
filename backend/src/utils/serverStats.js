const si = require('systeminformation');
const os = require('os');

const processStartTime = Date.now();

// Loopback/virtual interfaces would otherwise dilute or duplicate the real
// traffic numbers, so only physical/active interfaces are summed.
const isRealInterface = (iface) =>
  iface.iface && !iface.internal && iface.operstate !== 'down';

async function collectStats() {
  const [cpu, mem, fsSize, networkStats] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats('*'),
  ]);

  const primaryDisk = fsSize.reduce(
    (largest, d) => (d.size > (largest?.size || 0) ? d : largest),
    null
  );

  const relevantNets = networkStats.filter(isRealInterface);
  const rxBytesPerSec = relevantNets.reduce((sum, n) => sum + (n.rx_sec || 0), 0);
  const txBytesPerSec = relevantNets.reduce((sum, n) => sum + (n.tx_sec || 0), 0);

  return {
    timestamp: Date.now(),
    cpu: {
      loadPercent: Number(cpu.currentLoad.toFixed(1)),
    },
    memory: {
      totalBytes: mem.total,
      // 'active' excludes reclaimable cache/buffers — a truer "in use"
      // figure than total-free for gauging real memory pressure.
      usedBytes: mem.active,
      usedPercent: Number(((mem.active / mem.total) * 100).toFixed(1)),
    },
    disk: primaryDisk
      ? {
          mount: primaryDisk.mount,
          totalBytes: primaryDisk.size,
          usedBytes: primaryDisk.used,
          usedPercent: Number(primaryDisk.use.toFixed(1)),
        }
      : null,
    network: {
      rxBytesPerSec: Math.round(rxBytesPerSec),
      txBytesPerSec: Math.round(txBytesPerSec),
    },
    uptime: {
      processSeconds: Math.floor((Date.now() - processStartTime) / 1000),
      systemSeconds: Math.floor(os.uptime()),
    },
  };
}

module.exports = { collectStats };
