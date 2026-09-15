const mongoose = require("mongoose");
const Contact = require("../models/Contact");
const User = require("../models/User");
const { BadRequestError, ForbiddenError, NotFoundError } = require("../errors");
const { isBlockedEitherWay } = require("./blockService");

// Whether a phone number is visible in a chat's "contact card" is gated on
// BOTH people having added each other — not stored as its own flag (see
// Contact.js), computed fresh from the two directional edges every time, so
// it can never drift out of sync with either side unadding the other.

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const addContact = async ({ ownerId, contactId }) => {
  if (!isValidId(contactId)) throw new BadRequestError("A valid person is required");
  if (String(contactId) === String(ownerId)) {
    throw new BadRequestError("You can't add yourself as a contact");
  }

  const person = await User.findOne({
    _id: contactId,
    isActive: true,
    isBanned: false,
  }).select("_id");
  if (!person) throw new NotFoundError("Person not found");

  if (await isBlockedEitherWay({ a: ownerId, b: contactId })) {
    throw new ForbiddenError("You can't add this contact");
  }

  // Upsert, not create — adding someone already in your contacts is a no-op,
  // not a duplicate-key error.
  await Contact.updateOne(
    { owner: ownerId, contact: contactId },
    { $setOnInsert: { owner: ownerId, contact: contactId } },
    { upsert: true }
  );
};

const removeContact = async ({ ownerId, contactId }) => {
  if (!isValidId(contactId)) throw new BadRequestError("A valid person is required");
  await Contact.deleteOne({ owner: ownerId, contact: contactId });
};

/**
 * The chat header's "contact card" — the counterparty's basic profile, plus
 * their phone number ONLY when both sides have added each other. Not being
 * a mutual contact is a normal, common state, never an error.
 */
const getContactCard = async ({ viewerId, personId }) => {
  if (!isValidId(personId)) throw new NotFoundError("Person not found");

  const person = await User.findOne({
    _id: personId,
    isActive: true,
    isBanned: false,
  })
    .select("firstName lastName username phoneNumber")
    .lean();
  if (!person) throw new NotFoundError("Person not found");

  const [iAddedThem, theyAddedMe] = await Promise.all([
    Contact.exists({ owner: viewerId, contact: personId }),
    Contact.exists({ owner: personId, contact: viewerId }),
  ]);

  const mutual = Boolean(iAddedThem) && Boolean(theyAddedMe);

  return {
    _id: person._id,
    firstName: person.firstName,
    lastName: person.lastName,
    username: person.username,
    // Omitted entirely (not just falsy) when not mutual, so the client can't
    // accidentally render a stale/undefined phone as "no phone" vs "hidden."
    ...(mutual ? { phoneNumber: person.phoneNumber } : {}),
    isContact: Boolean(iAddedThem),
  };
};

/** Every person this account has added — the account menu's "Contacts" list. */
const listContacts = async ({ ownerId }) => {
  const rows = await Contact.find({ owner: ownerId })
    .populate("contact", "firstName lastName username")
    .sort({ createdAt: -1 })
    .lean();

  return rows
    .filter((row) => row.contact) // guards against a populate miss if the target account was deleted
    .map((row) => ({
      _id: row.contact._id,
      firstName: row.contact.firstName,
      lastName: row.contact.lastName,
      username: row.contact.username,
    }));
};

module.exports = { addContact, removeContact, getContactCard, listContacts };
