const Event = require('../models/Event');

/**
 * Update ticket availability based on current date and quantity
 * This function handles wave progression based on both time and sold-out status
 */
const updateTicketAvailability = async () => {
  try {
    const currentDate = new Date();
    
    // Find all events with ticket types that have date ranges
    const events = await Event.find({
      'ticketTypes.startDate': { $exists: true },
      'ticketTypes.endDate': { $exists: true }
    });

    let updatedCount = 0;

    for (const event of events) {
      let eventUpdated = false;
      const ticketTypes = event.ticketTypes;

      // Find wave tickets
      const firstWave = ticketTypes.find(t => t.name === 'Regular - First Wave');
      const secondWave = ticketTypes.find(t => t.name === 'Regular - Second Wave');
      const finalWave = ticketTypes.find(t => t.name === 'Regular - Final Wave');

      // Update regular ticket availability based on date/quantity
      ticketTypes.forEach(ticket => {
        if (ticket.startDate && ticket.endDate) {
          const startDate = new Date(ticket.startDate);
          const endDate = new Date(ticket.endDate);
          endDate.setHours(23, 59, 59, 999);
          
          const isInDateRange = currentDate >= startDate && currentDate <= endDate;
          const hasQuantity = ticket.quantity > 0;
          const shouldBeAvailable = isInDateRange && hasQuantity;
          
          if (ticket.available !== shouldBeAvailable) {
            ticket.available = shouldBeAvailable;
            eventUpdated = true;
            console.log(`Updated ticket "${ticket.name}" for event "${event.title}": ${shouldBeAvailable ? 'activated' : 'deactivated'}`);
          }
        }
      });

      // Handle wave progression logic
      if (firstWave && secondWave && finalWave) {
        const firstWaveEnded = currentDate > new Date(firstWave.endDate) || firstWave.quantity <= 0;
        const secondWaveEnded = currentDate > new Date(secondWave.endDate) || secondWave.quantity <= 0;
        
        // Activate second wave if first wave ended (by date or quantity)
        if (firstWaveEnded && !secondWave.available) {
          const secondWaveStartDate = new Date(secondWave.startDate);
          const secondWaveEndDate = new Date(secondWave.endDate);
          secondWaveEndDate.setHours(23, 59, 59, 999);
          
          if (currentDate <= secondWaveEndDate && secondWave.quantity > 0) {
            secondWave.available = true;
            eventUpdated = true;
            console.log(`Activated second wave for event "${event.title}" - first wave ended`);
          }
        }
        
        // Activate final wave if second wave ended (by date or quantity)
        if (secondWaveEnded && !finalWave.available) {
          const finalWaveStartDate = new Date(finalWave.startDate);
          const finalWaveEndDate = new Date(finalWave.endDate);
          finalWaveEndDate.setHours(23, 59, 59, 999);
          
          if (currentDate <= finalWaveEndDate && finalWave.quantity > 0) {
            finalWave.available = true;
            eventUpdated = true;
            console.log(`Activated final wave for event "${event.title}" - second wave ended`);
          }
        }
        
        // Deactivate previous waves when next wave is active
        if (secondWave.available && firstWave.available) {
          firstWave.available = false;
          eventUpdated = true;
          console.log(`Deactivated first wave for event "${event.title}" - second wave active`);
        }
        
        if (finalWave.available && secondWave.available) {
          secondWave.available = false;
          eventUpdated = true;
          console.log(`Deactivated second wave for event "${event.title}" - final wave active`);
        }
      }

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
    console.error('Error updating ticket availability:', error);
    return { success: false, error: error.message };
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
  
  console.log('Ticket availability scheduler started - running every minute');
};

module.exports = {
  updateTicketAvailability,
  startTicketScheduler
};