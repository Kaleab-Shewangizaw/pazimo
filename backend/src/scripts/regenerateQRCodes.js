const mongoose = require("mongoose");
const path = require("path");
const Ticket = require("../models/Ticket");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const regenerateQRCodes = async () => {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const tickets = await Ticket.find({});
    console.log(`Found ${tickets.length} tickets to regenerate.`);

    let count = 0;
    for (const ticket of tickets) {
      // Clear QR code to trigger regeneration in pre-save hook
      ticket.qrCode = undefined;

      // We need to ensure the event is populated if the hook relies on it?
      // The hook uses this.event.toString(), so as long as it's an ID it's fine.
      // But wait, the hook logic:
      // const qrPayload = { ... eventId: this.event.toString() ... }
      // If this.event is just an ID, toString() works.

      await ticket.save();
      count++;
      if (count % 10 === 0) process.stdout.write(".");
    }

    console.log(`\nSuccessfully regenerated ${count} QR codes.`);
    process.exit(0);
  } catch (error) {
    console.error("Error regenerating QR codes:", error);
    process.exit(1);
  }
};

regenerateQRCodes();
