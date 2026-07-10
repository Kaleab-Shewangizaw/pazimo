const FraudBlacklist = require("../models/FraudBlacklist");
const User = require("../models/User");
const { smsQueue } = require("../services/smsQueue");

// 1st confirmed tamper attempt from a phone number = warning SMS + blacklist entry.
// 2nd (or later) attempt from the same phone = permanent platform ban.
const BAN_THRESHOLD = 2;

const normalizePhone = (phone) => {
  if (!phone) return null;
  let formatted = phone.toString().trim().replace(/[\s+]/g, "");
  if (!formatted) return null;
  if (formatted.startsWith("0")) {
    formatted = "251" + formatted.substring(1);
  } else if (!formatted.startsWith("251")) {
    formatted = "251" + formatted;
  }
  return formatted;
};

// User.phoneNumber isn't stored consistently across the platform (some rows
// have "+251...", some "0...", some bare "251..."). Any ban/lookup by phone
// has to match all of those or it silently misses real accounts.
const phoneVariants = (normalized) => {
  const local = "0" + normalized.slice(3);
  return [normalized, "+" + normalized, local];
};

const isPhoneBanned = async (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const entry = await FraudBlacklist.findOne({ phoneNumber: normalized });
  return !!(entry && entry.bannedAt);
};

// Records a detected payment-tampering attempt, warns the phone number on the
// first offense, and bans it (plus any linked User accounts) from the second
// offense onward. Call this only when tampering is actually confirmed
// server-side (amount mismatch, forged reference, unauthorized internal call)
// — never for ordinary failed/cancelled payments.
const flagTamperAttempt = async ({ phone, userId, reason, meta = {} }) => {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    console.warn(`[FRAUD] Tamper attempt detected with no phone to flag (${reason})`, meta);
    return { flagged: false, banned: false };
  }

  const entry = await FraudBlacklist.findOneAndUpdate(
    { phoneNumber: normalized },
    {
      $inc: { offenseCount: 1 },
      $push: { incidents: { reason, meta, at: new Date() } },
      $setOnInsert: { phoneNumber: normalized },
    },
    { upsert: true, new: true }
  );

  console.warn(`[FRAUD] Offense #${entry.offenseCount} from ${normalized}: ${reason}`, meta);

  if (entry.offenseCount >= BAN_THRESHOLD) {
    if (!entry.bannedAt) {
      entry.bannedAt = new Date();
      await entry.save();
    }

    const variants = phoneVariants(normalized);
    const banFilter = userId
      ? { $or: [{ _id: userId }, { phoneNumber: { $in: variants } }] }
      : { phoneNumber: { $in: variants } };

    await User.updateMany(banFilter, {
      isActive: false,
      isBanned: true,
      banReason: "Repeated payment manipulation attempts",
      bannedAt: new Date(),
    });

    await smsQueue.enqueue(
      normalized,
      "Pazimo Security Alert: Your account and phone number have been permanently banned from Pazimo due to repeated payment manipulation attempts.",
      { priority: "high", metadata: { reason: "fraud-ban" } }
    );

    return { flagged: true, banned: true, offenseCount: entry.offenseCount };
  }

  await smsQueue.enqueue(
    normalized,
    "Pazimo Security Alert: We detected a suspicious attempt to manipulate a payment using this number. This is a warning — a repeat attempt will result in a permanent ban from the platform.",
    { priority: "high", metadata: { reason: "fraud-warning" } }
  );

  return { flagged: true, banned: false, offenseCount: entry.offenseCount };
};

module.exports = { normalizePhone, isPhoneBanned, flagTamperAttempt, phoneVariants };
