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
  let failedCount = 0;

  try {
    const currentDate = new Date();

    // Use cursor to stream events instead of loading all into memory.
    const cursor = Event.find({ ticketTypes: { $exists: true, $ne: [] } }).cursor();

    for await (const event of cursor) {
      // Isolate each event. A single document that fails validation on save —
      // an old record missing a now-required field, say — used to throw out of
      // this loop, so every event after it in the cursor silently stopped
      // getting wave transitions, on every tick, forever.
      try {
        const { changed: eventUpdated } = applyTicketAvailabilityRules(
          event,
          currentDate
        );

        // Save the event if any tickets were updated
        if (eventUpdated) {
          await event.save();
          updatedCount++;
        }
      } catch (eventError) {
        failedCount++;
        console.error(
          `Ticket availability update failed for event ${event?._id}:`,
          eventError.message
        );
      }
    }

    if (updatedCount > 0) {
      console.log(`Ticket availability updated for ${updatedCount} events`);
    }

    if (failedCount > 0) {
      console.error(
        `Ticket availability skipped ${failedCount} event(s) that failed to save`
      );
    }

    return { success: true, updatedEvents: updatedCount, failedEvents: failedCount };
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
