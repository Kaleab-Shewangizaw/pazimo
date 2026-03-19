const Event = require("../models/Event");
const { applyTicketAvailabilityRules } = require("./ticketAvailability");

let isSchedulerRunning = false;

const updateTicketAvailability = async () => {
  if (isSchedulerRunning) {
    // console.log('Scheduler skipped: Previous run still in progress');
    return { success: false, message: "Skipped" };
  }

  isSchedulerRunning = true;
  let updatedCount = 0;

  try {
    const currentDate = new Date();

    // Use cursor to stream events instead of loading all into memory.
    const cursor = Event.find({ ticketTypes: { $exists: true, $ne: [] } }).cursor();

    for await (const event of cursor) {
      const { changed: eventUpdated } = applyTicketAvailabilityRules(
        event,
        currentDate
      );

      // Save the event if any tickets were updated
      if (eventUpdated) {
        await event.save();
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`Ticket availability updated for ${updatedCount} events`);
    }

    return { success: true, updatedEvents: updatedCount };
  } catch (error) {
    console.error("Error updating ticket availability:", error);
    return { success: false, error: error.message };
  } finally {
    isSchedulerRunning = false;
  }
};

/**
 * Start the ticket scheduler to run every minute
 */
const startTicketScheduler = () => {
  // Run immediately on startup
  updateTicketAvailability();

  // Then run every minute (60000 ms)
  setInterval(updateTicketAvailability, 60000);

  console.log("Ticket availability scheduler started - running every minute");
};

module.exports = {
  updateTicketAvailability,
  startTicketScheduler,
};
