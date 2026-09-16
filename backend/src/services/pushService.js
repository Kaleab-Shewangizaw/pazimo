const { Expo } = require("expo-server-sdk");
const User = require("../models/User");

// One SDK client for the whole process, matching how `socket.io`'s `io`
// instance is created once in server.js and reused everywhere.
const expo = new Expo();

/**
 * Sends a push notification to every device this account is signed into.
 * Best-effort, same posture as every `notifyUser` socket emit already in
 * this codebase (ticketShareController, conversationController, ...): a
 * failed or slow push must never fail the request that triggered it, so
 * every error is swallowed here rather than propagated.
 *
 * `preferenceKey` gates delivery against `User.notificationPreferences` —
 * the mobile settings screen's toggles have existed since before this file
 * did (see that schema field's comment) with nothing actually reading them
 * until now.
 *
 * Ticket-level errors (a token Expo now considers dead) prune that token
 * immediately. Expo's fuller receipt flow — fetching delivery receipts a
 * few seconds after sending, which catches a "DeviceNotRegistered" that
 * only surfaces at delivery rather than at send — is deliberately scoped
 * out: it needs a receipt-id store and a polling job, real infrastructure
 * this pass doesn't add. A token that only fails at that later stage just
 * lingers until it fails at the ticket stage some other time, or the user
 * re-registers it on next app launch.
 */
const sendPushToUser = async ({ userId, preferenceKey, title, body, data }) => {
  try {
    const user = await User.findById(userId).select("pushTokens notificationPreferences");
    if (!user || !user.pushTokens.length) return;
    if (preferenceKey && user.notificationPreferences?.[preferenceKey] === false) return;

    const messages = user.pushTokens
      .filter((token) => Expo.isExpoPushToken(token))
      .map((token) => ({ to: token, sound: "default", title, body, data }));
    if (!messages.length) return;

    const deadTokens = [];
    for (const chunk of expo.chunkPushNotifications(messages)) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          deadTokens.push(chunk[i].to);
        }
      });
    }

    if (deadTokens.length) {
      await User.updateOne({ _id: userId }, { $pull: { pushTokens: { $in: deadTokens } } });
    }
  } catch (error) {
    console.error(`Failed to send push to user ${userId}:`, error.message);
  }
};

/** Idempotent — the same device re-registering (app relaunch, token refresh) is a no-op, not a duplicate. */
const registerPushToken = async ({ userId, token }) => {
  if (!Expo.isExpoPushToken(token)) return;
  await User.updateOne({ _id: userId }, { $addToSet: { pushTokens: token } });
};

/** Called best-effort on sign-out — this device shouldn't keep getting this account's pushes once it's signed out of it. */
const unregisterPushToken = async ({ userId, token }) => {
  await User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });
};

module.exports = { sendPushToUser, registerPushToken, unregisterPushToken };
