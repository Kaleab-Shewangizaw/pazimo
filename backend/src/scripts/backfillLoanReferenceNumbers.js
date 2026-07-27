const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Loan = require("../models/Loan");

// One-off backfill for loans created before referenceNumber existed. Safe to
// re-run: each save() re-triggers the pre-validate hook only for documents
// still missing the field, so already-numbered loans are left untouched.
const backfillLoanReferenceNumbers = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn(
        "MONGODB_URI is not defined in .env, please pass it as env var"
      );
    }
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("Connected to MongoDB");

    const loans = await Loan.find({
      $or: [{ referenceNumber: { $exists: false } }, { referenceNumber: null }],
    }).sort("createdAt");

    console.log(`Found ${loans.length} loan(s) without a reference number`);

    for (const loan of loans) {
      await loan.save();
      console.log(`  ${loan._id} -> ${loan.referenceNumber}`);
    }

    console.log("Backfill complete");
    process.exit(0);
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exit(1);
  }
};

backfillLoanReferenceNumbers();
