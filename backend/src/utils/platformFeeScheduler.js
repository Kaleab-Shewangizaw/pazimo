const cron = require("node-cron");
const { runAutoSendForYesterday } = require("../services/platformFeeService");

let isRunning = false;

const tick = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    const result = await runAutoSendForYesterday();
    if (!result.skipped) {
      console.log(`[PLATFORM-FEE] Finalized daily ledger for ${result.date}`);
    }
  } catch (error) {
    console.error("[PLATFORM-FEE] Scheduler tick failed:", error.message);
  } finally {
    isRunning = false;
  }
};

// Fires once daily at 00:05 Africa/Addis_Ababa — a few minutes after
// midnight so the previous day's payments have had a moment to settle.
// Idempotent (guarded by PlatformFeeConfig.lastAutoRunDate), so restarts
// or a missed tick just get picked up on the next check.
const startPlatformFeeScheduler = () => {
  cron.schedule("5 0 * * *", tick, { timezone: "Africa/Addis_Ababa" });
  // Also run once on boot in case the server was down at 00:05 and a day
  // is sitting unfinalized.
  tick();
  console.log("Platform fee scheduler started - daily at 00:05 Africa/Addis_Ababa");
};

module.exports = { startPlatformFeeScheduler };
