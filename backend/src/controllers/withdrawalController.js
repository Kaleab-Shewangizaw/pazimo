const Withdrawal = require("../models/Withdrawal");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const { StatusCodes } = require("http-status-codes");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");
const Notification = require("../models/Notification");
const { calculateOrganizerBalance } = require("../services/financeService");
const { syncOrganizerLoans } = require("../services/loanRepaymentService");
const { TELEBIRR_FEE_RATE } = require("../config/rates");
const { mirrorWithdrawal } = require("../services/ledgerDualWrite");

// Get organizer's available balance. Ticket revenue and any borrowed Pazimo
// Capital principal are now a single pool: the advance is credited straight in
// and repaid automatically via a 60% cut of post-approval ticket sales (see
// financeService.calculateOrganizerBalance).
const getOrganizerBalance = async (req, res) => {
  try {
    // Organizers may only ever see their own balance; only admins can view another's.
    const organizerId =
      req.user.role === "organizer" ? req.user.userId : req.params.organizerId;
    const currency = req.query.currency === "USD" ? "USD" : "ETB";

    // Bring any active advance up to date with the latest ticket sales before
    // reading the balance, so repayment progress and notifications stay current.
    await syncOrganizerLoans(organizerId, req);

    const balanceData = await calculateOrganizerBalance(organizerId, currency);

    res.status(StatusCodes.OK).json({
      success: true,
      data: balanceData,
    });
  } catch (error) {
    console.error("Error getting organizer balance:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get organizer balance",
      error: error.message,
    });
  }
};

/**
 * A venue settling its bar takings.
 *
 * Split out from createWithdrawal rather than folded into it because almost
 * nothing is shared: the balance comes from a different ledger
 * (VenueBeverageSale, via calculateVenueBalance), there is no Pazimo Capital
 * position to sync, and the pool is "venue_beverages". Threading a venue
 * through the organizer path would leave the loan sync and the organizer
 * balance check one missed condition away from being applied to a venue.
 *
 * The row still lands in the same Withdrawal collection and the same admin
 * approval queue — one place money leaves, exactly as Withdrawal.stream
 * documents. `organizer` carries the venue's account: the field is a User
 * reference and the name is historical.
 */
const createVenueWithdrawal = async (req, res) => {
  const Venue = require("../models/Venue");
  const { calculateVenueBalance } = require("../services/financeService");

  const { amount, notes, bankDetails } = req.body;
  const currency = req.body.currency === "USD" ? "USD" : "ETB";

  // VenueBeverageSale is ETB-only, so a USD request could only ever validate
  // against a zero balance — reject it with the real reason instead.
  if (currency !== "ETB") {
    throw new BadRequestError("Venue beverage sales are ETB only");
  }

  // An admin acting for a venue names it explicitly; a venue account is always
  // resolved from the account itself, never from the request body, so it cannot
  // request a payout against another venue's balance.
  const venue =
    req.user.role === "admin"
      ? await Venue.findById(req.body.venueId)
      : await Venue.findOne({ account: req.user.userId });

  if (!venue) {
    throw new NotFoundError(
      req.user.role === "admin"
        ? "Venue not found — a valid venueId is required"
        : "This account is not linked to a venue"
    );
  }

  const balance = await calculateVenueBalance(venue._id, currency);
  const availableBalance = balance.streams.venueBeverages.availableBalance;

  const requested = Number(amount);
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new BadRequestError("Withdrawal amount must be greater than zero");
  }
  if (requested > availableBalance) {
    throw new BadRequestError(
      `Withdrawal exceeds this venue's balance of ${availableBalance.toFixed(2)} ${currency}`
    );
  }

  // Telebirr takes a 2% cut on payouts, passed through the same way it is for
  // organizers.
  const feeAmount =
    bankDetails?.bankName === "telebirr" ? requested * TELEBIRR_FEE_RATE : 0;

  const withdrawal = await Withdrawal.create({
    organizer: venue.account,
    venue: venue._id,
    stream: "venue_beverages",
    amount: requested,
    currency,
    notes,
    bankDetails,
    feeAmount,
    netAmount: requested - feeAmount,
    processedBy: req.user.role === "admin" ? req.user.userId : undefined,
    status: "pending",
  });

  // Shadow-write to the ledger. Never allowed to fail the payout while the
  // ledger is still a shadow copy — see services/ledgerDualWrite.
  await mirrorWithdrawal({
    owner: { kind: "venue", id: venue._id },
    stream: "beverages",
    amount: requested,
    withdrawalId: withdrawal._id,
    currency,
    occurredAt: withdrawal.createdAt,
  });

  return res.status(StatusCodes.CREATED).json({ success: true, data: withdrawal });
};

/**
 * A cinema settling one of its two pools.
 *
 * Split out for the same reason createVenueWithdrawal is: the balance comes from
 * different ledgers (CinemaTicket and CinemaBeverageSale, via
 * calculateCinemaBalance), and there is no Pazimo Capital position to sync —
 * advances are underwritten against event ticket revenue, which a cinema has
 * none of.
 *
 * Unlike a venue, a cinema has TWO pools and the request must say which. They
 * are validated independently, so seat money cannot fund a concession payout or
 * the reverse — the same discipline the organizer side applies to door vs bar
 * takings.
 *
 * The row still lands in the same Withdrawal collection and the same admin
 * approval queue. `organizer` carries the cinema's account: the field is a User
 * reference and the name is historical.
 */
const createCinemaWithdrawal = async (req, res) => {
  const Cinema = require("../models/Cinema");
  const {
    calculateCinemaBalance,
    CINEMA_WITHDRAWAL_STREAMS,
  } = require("../services/cinemaFinanceService");

  const { amount, notes, bankDetails } = req.body;
  const currency = req.body.currency === "USD" ? "USD" : "ETB";

  // Both cinema ledgers are ETB-only, so a USD request could only ever validate
  // against a zero balance — reject it with the real reason instead.
  if (currency !== "ETB") {
    throw new BadRequestError("Cinema sales are ETB only");
  }

  const stream = req.body.stream;
  const poolKey = CINEMA_WITHDRAWAL_STREAMS[stream];
  if (!poolKey) {
    throw new BadRequestError(
      "stream must be 'cinema_tickets' or 'cinema_beverages'"
    );
  }

  // An admin acting for a cinema names it explicitly; a cinema account is always
  // resolved from the account itself, never from the request body, so it cannot
  // request a payout against another cinema's balance.
  const cinema =
    req.user.role === "admin"
      ? await Cinema.findById(req.body.cinemaId)
      : await Cinema.findOne({ account: req.user.userId });

  if (!cinema) {
    throw new NotFoundError(
      req.user.role === "admin"
        ? "Cinema not found — a valid cinemaId is required"
        : "This account is not linked to a cinema"
    );
  }

  const balance = await calculateCinemaBalance(cinema._id, currency);
  // Scoped to the ONE pool named in the request. Never balance.availableBalance,
  // which is the sum of both and exists for display only.
  const availableBalance = balance.streams[poolKey].availableBalance;

  const requested = Number(amount);
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new BadRequestError("Withdrawal amount must be greater than zero");
  }
  if (requested > availableBalance) {
    throw new BadRequestError(
      `Withdrawal exceeds this cinema's ${poolKey} balance of ${availableBalance.toFixed(2)} ${currency}`
    );
  }

  // Telebirr takes a 2% cut on payouts, passed through the same way it is for
  // organizers and venues.
  const feeAmount =
    bankDetails?.bankName === "telebirr" ? requested * TELEBIRR_FEE_RATE : 0;

  const withdrawal = await Withdrawal.create({
    organizer: cinema.account,
    cinema: cinema._id,
    stream,
    amount: requested,
    currency,
    notes,
    bankDetails,
    feeAmount,
    netAmount: requested - feeAmount,
    processedBy: req.user.role === "admin" ? req.user.userId : undefined,
    status: "pending",
  });

  await mirrorWithdrawal({
    owner: { kind: "cinema", id: cinema._id },
    stream: poolKey,
    amount: requested,
    withdrawalId: withdrawal._id,
    currency,
    occurredAt: withdrawal.createdAt,
  });

  return res
    .status(StatusCodes.CREATED)
    .json({ success: true, data: withdrawal });
};

// Create withdrawal request
const createWithdrawal = async (req, res) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError("User not authenticated");
    }

    let organizerId;
    const { amount, notes, bankDetails } = req.body;
    const currency = req.body.currency === "USD" ? "USD" : "ETB";

    // Which pool this request draws from. Ticket and beverage revenue are
    // withdrawn separately, so the balance check has to be scoped or an
    // organizer could drain one pool using the other's balance.
    const stream = req.body.stream === "beverages" ? "beverages" : "tickets";

    if (stream === "beverages" && currency !== "ETB") {
      throw new BadRequestError("Beverage sales are ETB only");
    }

    // Venue payouts take an entirely separate path below: their balance comes
    // from a different ledger and their pool is "venue_beverages", never
    // "beverages". Handled first so no venue request can fall through into the
    // organizer branches and be validated against an organizer's balance.
    if (
      req.user.role === "venue" ||
      (req.user.role === "admin" && req.body.stream === "venue_beverages")
    ) {
      return await createVenueWithdrawal(req, res);
    }

    // Cinema payouts take their own path for the same reason: two separate
    // pools, from ledgers no organizer query reads. Handled before the organizer
    // branches so no cinema request can fall through and be validated against an
    // organizer's balance.
    if (
      req.user.role === "cinema" ||
      (req.user.role === "admin" &&
        ["cinema_tickets", "cinema_beverages"].includes(req.body.stream))
    ) {
      return await createCinemaWithdrawal(req, res);
    }

    if (req.user.role === "admin") {
      organizerId = req.body.organizerId;
      if (!organizerId) {
        throw new BadRequestError(
          "Organizer ID is required for admin withdrawal creation"
        );
      }
    } else if (req.user.role === "organizer") {
      organizerId = req.user.userId;
    } else {
      throw new UnauthorizedError(
        "Only admins or organizers can create withdrawals"
      );
    }

    // Ticket revenue and borrowed principal share one balance now — sync any
    // active advance to the latest ticket sales, then validate against it.
    await syncOrganizerLoans(organizerId, req);
    const balance = await calculateOrganizerBalance(organizerId, currency);

    const availableBalance =
      stream === "beverages"
        ? balance.streams.beverages.availableBalance
        : balance.streams.tickets.availableBalance;

    const requested = Number(amount);
    if (!Number.isFinite(requested) || requested <= 0) {
      throw new BadRequestError("Withdrawal amount must be greater than zero");
    }
    if (requested > availableBalance) {
      throw new BadRequestError(
        stream === "beverages"
          ? `Withdrawal exceeds your beverage balance of ${availableBalance.toFixed(2)} ${currency}`
          : `Withdrawal exceeds your ticket balance of ${availableBalance.toFixed(2)} ${currency}`
      );
    }

    // Telebirr takes a 2% cut on withdrawal payouts; that cost is now passed
    // through to the organizer rather than absorbed by the platform, so the
    // requested amount stays as the balance deduction while the payout the
    // organizer actually receives is reduced by the fee.
    const TELEBIRR_FEE_RATE = 0.02;
    const feeAmount =
      bankDetails?.bankName === "telebirr" ? amount * TELEBIRR_FEE_RATE : 0;
    const netAmount = amount - feeAmount;

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      organizer: organizerId,
      stream,
      amount,
      currency,
      notes,
      bankDetails,
      feeAmount,
      netAmount,
      processedBy: req.user.role === "admin" ? req.user.userId : undefined,
      status: "pending",
    });

    // Shadow-write to the ledger — same as createVenueWithdrawal/
    // createCinemaWithdrawal below. This was missing entirely until now: the
    // organizer path never mirrored a payout, so the ledger's "organizer"
    // owner kind was silently short by every organizer withdrawal ever made.
    await mirrorWithdrawal({
      owner: { kind: "organizer", id: organizerId },
      stream,
      amount: requested,
      withdrawalId: withdrawal._id,
      currency,
      occurredAt: withdrawal.createdAt,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error creating withdrawal:", error);
    // Honour the error's own status instead of reporting everything as a 500.
    //
    // Every rejection this endpoint raises is a BadRequestError carrying the
    // real reason — "Withdrawal exceeds your ticket balance of X", "stream must
    // be cinema_tickets or cinema_beverages" — and all of them were being
    // flattened into a 500 "Failed to create withdrawal request". That told an
    // organizer asking for more than their balance that the server had broken,
    // and hid the figure they needed. Matches how every other controller in the
    // codebase resolves its status.
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({
      success: false,
      message:
        status === StatusCodes.INTERNAL_SERVER_ERROR
          ? "Failed to create withdrawal request"
          : error.message,
      error: error.message,
    });
  }
};

// Update withdrawal status
const updateWithdrawalStatus = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { status, notes, transactionId } = req.body;

    console.log("Updating withdrawal status:", {
      withdrawalId,
      status,
      notes,
      transactionId,
    });

    if (!req.user) {
      throw new UnauthorizedError("User not authenticated");
    }

    // Verify admin role
    if (req.user.role !== "admin") {
      throw new UnauthorizedError("Only admins can update withdrawal status");
    }

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      throw new NotFoundError("Withdrawal request not found");
    }

    console.log("Found withdrawal:", {
      id: withdrawal._id,
      organizer: withdrawal.organizer,
      amount: withdrawal.amount,
      currentStatus: withdrawal.status,
      newStatus: status,
    });

    const previousStatus = withdrawal.status;

    // Update withdrawal
    withdrawal.status = status;
    withdrawal.notes = notes || withdrawal.notes;
    withdrawal.transactionId = transactionId || withdrawal.transactionId;
    withdrawal.processedBy = req.user.userId;
    withdrawal.processedAt = new Date();

    await withdrawal.save();
    console.log("Withdrawal updated successfully");

    // createWithdrawal/createVenueWithdrawal/createCinemaWithdrawal all
    // shadow-write the payout to the ledger the moment the request is made
    // (status "pending"), before an admin ever looks at it. If it's being
    // rejected instead of approved/completed, that deduction never actually
    // happened — mirror the reversal so the ledger doesn't permanently
    // understate this owner's balance. Guarded on the actual transition
    // (never fires twice for an already-rejected row); rejected is treated
    // as terminal here — an admin flipping a rejected row back to
    // pending/approved would need a fresh ledger mirror this doesn't add,
    // same as it doesn't get a fresh Withdrawal document either.
    if (status === "rejected" && previousStatus !== "rejected") {
      const { CINEMA_WITHDRAWAL_STREAMS } = require("../services/cinemaFinanceService");
      const owner = withdrawal.cinema
        ? { kind: "cinema", id: withdrawal.cinema }
        : withdrawal.venue
          ? { kind: "venue", id: withdrawal.venue }
          : { kind: "organizer", id: withdrawal.organizer };
      const stream = withdrawal.cinema
        ? CINEMA_WITHDRAWAL_STREAMS[withdrawal.stream]
        : withdrawal.venue
          ? "beverages"
          : withdrawal.stream;

      await mirrorWithdrawal({
        owner,
        stream,
        amount: withdrawal.amount,
        withdrawalId: withdrawal._id,
        currency: withdrawal.currency,
        reversal: true,
        occurredAt: withdrawal.processedAt,
      });
    }

    // Emit notification
    const notification = await Notification.create({
      userId: withdrawal.organizer,
      type: "withdrawal_status_change",
      message: `Your withdrawal of ${withdrawal.amount} ${withdrawal.currency} has been ${withdrawal.status}.`,
      withdrawalId: withdrawal._id,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      status: withdrawal.status,
      read: false,
    });
    console.log("Notification created:", notification._id);

    // Emit socket event to the organizer's room
    const io = req.app.get("io");
    if (io) {
      const roomName = `organizer_${withdrawal.organizer}`;
      console.log("Emitting to room:", roomName);
      io.to(roomName).emit("withdrawalStatusUpdated", {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        status: withdrawal.status,
      });
      console.log("Socket event emitted");
    } else {
      console.log("Socket.IO not available");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update withdrawal status",
      error: error.message,
    });
  }
};

// Get all withdrawals (admin) - OPTIMIZED
const getAllWithdrawals = async (req, res) => {
  try {
    const { status, organizerId, page = 1, limit = 10 } = req.query;
    const currency = req.query.currency === "USD" ? "USD" : req.query.currency === "ETB" ? "ETB" : null;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (status && status !== "all") query.status = status;
    if (organizerId) query.organizer = organizerId;
    if (req.query.venueId) query.venue = req.query.venueId;
    // "beverages" means an organizer's event bar takings and never a venue's —
    // the two are separate pools, so the filter must not fold them together.
    if (req.query.stream === "beverages") query.stream = "beverages";
    else if (req.query.stream === "venue_beverages") query.stream = "venue_beverages";
    // A cinema's two pools are filterable separately, which is the whole point
    // of their being separate streams.
    else if (req.query.stream === "cinema_tickets") query.stream = "cinema_tickets";
    else if (req.query.stream === "cinema_beverages") query.stream = "cinema_beverages";
    else if (req.query.stream === "tickets") {
      query.$and = [{ $or: [{ stream: "tickets" }, { stream: { $exists: false } }] }];
    }
    if (currency === "ETB") {
      query.$or = [{ currency: "ETB" }, { currency: { $exists: false } }];
    } else if (currency === "USD") {
      query.currency = "USD";
    }

    // Use Promise.all for parallel queries
    const [withdrawals, total, stats] = await Promise.all([
      // Get withdrawals with pagination using lean()
      Withdrawal.find(query)
        .populate("organizer", "firstName lastName email")
        // Venue rows carry the venue itself, so the admin queue can name the
        // business being paid rather than only the account behind it.
        .populate("venue", "name venueType city")
        .populate("processedBy", "firstName lastName email")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      
      // Get total count
      Withdrawal.countDocuments(query),
      
      // Get aggregated stats
      Withdrawal.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" }
          }
        }
      ])
    ]);

    // Format stats
    const statsFormatted = {
      pending: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      completed: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 }
    };

    stats.forEach(stat => {
      if (statsFormatted[stat._id]) {
        statsFormatted[stat._id] = {
          count: stat.count,
          amount: stat.totalAmount
        };
      }
    });

    res.status(StatusCodes.OK).json({
      status: "success",
      data: withdrawals,
      stats: statsFormatted,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error getting withdrawals:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to get withdrawals",
      error: error.message,
    });
  }
};

// Get organizer's withdrawals - OPTIMIZED
const getOrganizerWithdrawals = async (req, res) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError("User not authenticated");
    }

    let organizerId = req.params.organizerId;
    // Only allow admin to view any organizer, organizers can only view their own
    if (req.user.role === "organizer") {
      organizerId = req.user.userId;
    }
    // A venue reads its own payout history through this same endpoint: the rows
    // carry its account in `organizer`. Forced to the caller's own id for the
    // same reason organizers are — the :organizerId in the URL is not a
    // credential, and without this a venue could read anyone's payouts.
    if (req.user.role === "venue") {
      organizerId = req.user.userId;
    }
    // A cinema likewise. Forced for the same reason: the :organizerId in the URL
    // is not a credential, and without this a cinema account could read any
    // other account's payout history simply by changing it.
    if (req.user.role === "cinema") {
      organizerId = req.user.userId;
    }
    const { status, page = 1, limit = 10 } = req.query;
    const currency = req.query.currency === "USD" ? "USD" : req.query.currency === "ETB" ? "ETB" : null;
    const skip = (page - 1) * limit;

    // Build query
    const query = { organizer: organizerId };
    if (status && status !== "all") query.status = status;
    if (req.query.stream === "beverages") query.stream = "beverages";
    else if (req.query.stream === "venue_beverages") query.stream = "venue_beverages";
    // A cinema's two pools are filterable separately, which is the whole point
    // of their being separate streams.
    else if (req.query.stream === "cinema_tickets") query.stream = "cinema_tickets";
    else if (req.query.stream === "cinema_beverages") query.stream = "cinema_beverages";
    else if (req.query.stream === "tickets") {
      // Rows written before the split carry no stream and are ticket revenue.
      query.$and = [{ $or: [{ stream: "tickets" }, { stream: { $exists: false } }] }];
    }
    if (currency === "ETB") {
      query.$or = [{ currency: "ETB" }, { currency: { $exists: false } }];
    } else if (currency === "USD") {
      query.currency = "USD";
    }

    // Use Promise.all for parallel queries
    const [withdrawals, total, stats] = await Promise.all([
      // Get withdrawals with pagination using lean()
      Withdrawal.find(query)
        .populate("processedBy", "firstName lastName email")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      
      // Get total count
      Withdrawal.countDocuments(query),
      
      // Get aggregated stats for this organizer
      Withdrawal.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" }
          }
        }
      ])
    ]);

    // Format stats
    const statsFormatted = {
      pending: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      completed: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 }
    };

    stats.forEach(stat => {
      if (statsFormatted[stat._id]) {
        statsFormatted[stat._id] = {
          count: stat.count,
          amount: stat.totalAmount
        };
      }
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: withdrawals,
      stats: statsFormatted,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error getting organizer withdrawals:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get organizer withdrawals",
      error: error.message,
    });
  }
};

module.exports = {
  getOrganizerBalance,
  createWithdrawal,
  updateWithdrawalStatus,
  getAllWithdrawals,
  getOrganizerWithdrawals,
};
