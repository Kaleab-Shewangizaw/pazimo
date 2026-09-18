const express = require("express");
const router = express.Router();

const { authenticateUser } = require("../middlewares/auth");
const { messageWriteLimiter } = require("../middlewares/rateLimiters");
const {
  listConversations,
  listMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  getContactCard,
  addContact,
  removeContact,
  listContacts,
  listBlocked,
  blockUser,
  unblockUser,
  clearConversation,
  markRead,
} = require("../controllers/conversationController");

// Keyed by counterparty user id, not a conversation id — the client never
// needs to know a Conversation._id exists, matching how every share route is
// keyed by toUserId rather than some thread id.
router.use(authenticateUser);

// Static paths first — "/contacts" and "/blocked" would otherwise be
// swallowed by the "/:counterpartyId/..." routes below and treated as an id.
router.get("/contacts", listContacts);
router.get("/blocked", listBlocked);

router.get("/", listConversations);
// "Delete chat" — clears this account's own view of the thread, not the
// other participant's. Distinct path depth from the routes below, so it
// can't be shadowed by (or shadow) them.
router.delete("/:counterpartyId", clearConversation);
router.get("/:counterpartyId/messages", listMessages);
router.post("/:counterpartyId/messages", messageWriteLimiter, sendMessage);
router.patch("/:counterpartyId/messages/:messageId", messageWriteLimiter, editMessage);
router.delete("/:counterpartyId/messages/:messageId", messageWriteLimiter, deleteMessage);
// Marks this account's unread messages FROM counterpartyId as read — called
// when the thread screen opens, clearing that conversation's chat-list badge.
router.post("/:counterpartyId/read", markRead);

// The chat header's "contact card" — a person's username always, their phone
// number only once both sides have added each other (see contactService.js).
router.get("/:counterpartyId/contact-card", getContactCard);
router.post("/:counterpartyId/contact", addContact);
router.delete("/:counterpartyId/contact", removeContact);

router.post("/:counterpartyId/block", blockUser);
router.delete("/:counterpartyId/block", unblockUser);

module.exports = router;
