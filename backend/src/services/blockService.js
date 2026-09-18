const mongoose = require("mongoose");
const Block = require("../models/Block");
const Contact = require("../models/Contact");
const User = require("../models/User");
const { BadRequestError, NotFoundError } = require("../errors");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const blockUser = async ({ blockerId, blockedId }) => {
  if (!isValidId(blockedId)) throw new BadRequestError("A valid person is required");
  if (String(blockedId) === String(blockerId)) {
    throw new BadRequestError("You can't block yourself");
  }

  const person = await User.findOne({ _id: blockedId }).select("_id");
  if (!person) throw new NotFoundError("Person not found");

  // Upsert, not create — blocking someone already blocked is a no-op, not a
  // duplicate-key error.
  await Block.updateOne(
    { blocker: blockerId, blocked: blockedId },
    { $setOnInsert: { blocker: blockerId, blocked: blockedId } },
    { upsert: true }
  );

  // You can't stay contacts with someone you just blocked, in either
  // direction — drop both edges rather than leave a stale contact relation
  // sitting alongside a fresh block.
  await Contact.deleteMany({
    $or: [
      { owner: blockerId, contact: blockedId },
      { owner: blockedId, contact: blockerId },
    ],
  });
};

const unblockUser = async ({ blockerId, blockedId }) => {
  if (!isValidId(blockedId)) throw new BadRequestError("A valid person is required");
  await Block.deleteOne({ blocker: blockerId, blocked: blockedId });
};

const listBlocked = async ({ blockerId }) => {
  const rows = await Block.find({ blocker: blockerId })
    .populate("blocked", "firstName lastName username")
    .sort({ createdAt: -1 })
    .lean();

  return rows
    .filter((row) => row.blocked) // guards against a populate miss if the target account was deleted
    .map((row) => ({
      _id: row.blocked._id,
      firstName: row.blocked.firstName,
      lastName: row.blocked.lastName,
      username: row.blocked.username,
      blockedAt: row.createdAt,
    }));
};

/** True if either person has blocked the other — the gate used before a contact-add or a message send. */
const isBlockedEitherWay = async ({ a, b }) => {
  const [aBlockedB, bBlockedA] = await Promise.all([
    Block.exists({ blocker: a, blocked: b }),
    Block.exists({ blocker: b, blocked: a }),
  ]);
  return Boolean(aBlockedB) || Boolean(bBlockedA);
};

module.exports = { blockUser, unblockUser, listBlocked, isBlockedEitherWay };
