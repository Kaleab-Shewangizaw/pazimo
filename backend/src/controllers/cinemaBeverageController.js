const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Beverage = require("../models/Beverage");
const CinemaBeverage = require("../models/CinemaBeverage");
const CinemaBeverageSale = require("../models/CinemaBeverageSale");
const cinemaBeverageSalesService = require("../services/cinemaBeverageSalesService");
const { BadRequestError, NotFoundError } = require("../errors");
const { resolveCinema, assertBeverageEligible } = require("../utils/cinemaAccess");
const {
  getCinemaBeverageRevenue,
} = require("../utils/cinemaBeverageRevenueQuery");

// The cinema channel's concession surface — the twin of the event-side line-up
// routes in beverageController and the venue-side ones in venueController.
//
// Every handler resolves its cinema through resolveCinema, so a cinema account
// can only ever reach its own rows and an admin reaches the one named in the
// URL. No handler takes a cinema id from a request body.

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
};

// The set of catalogue products a given cinema may sell. An empty deny list
// means the whole active catalogue — see Cinema.blockedBeverages for why it is
// a deny list rather than an allow list.
const sellableQuery = (cinema) => {
  const blocked = cinema?.blockedBeverages || [];
  const query = { isActive: true };
  if (blocked.length > 0) query._id = { $nin: blocked };
  return query;
};

// ---------------------------------------------------------------------------
// Catalogue + line-up
// ---------------------------------------------------------------------------

/** The products this cinema is allowed to add, with what it already sells. */
const listSellableCatalog = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const { category } = req.query;

    const query = sellableQuery(cinema);
    if (category) query.category = category;

    const [catalog, lineup] = await Promise.all([
      Beverage.find(query).select("name image color category").sort("name").lean(),
      CinemaBeverage.find({ cinema: cinema._id }).select("beverage").lean(),
    ]);

    const alreadyListed = new Set(lineup.map((l) => String(l.beverage)));

    res.status(StatusCodes.OK).json({
      success: true,
      data: catalog.map((b) => ({
        ...b,
        // Lets the picker grey out what is already in the line-up rather than
        // letting the unique index reject it after the fact.
        inLineup: alreadyListed.has(String(b._id)),
      })),
    });
  } catch (error) {
    console.error("Error listing cinema catalogue:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** What this cinema sells, and at what price. */
const listLineup = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const { category } = req.query;

    const lineup = await CinemaBeverage.find({ cinema: cinema._id })
      .populate("beverage", "name image color category isActive")
      .sort("-createdAt")
      .lean();

    const filtered = category
      ? lineup.filter((l) => (l.beverage?.category || "drink") === category)
      : lineup;

    res.status(StatusCodes.OK).json({
      success: true,
      data: filtered.map((l) => ({
        ...l,
        // Derived rather than stored: stockTotal and sold are the truth, and a
        // third counter would be one more thing to keep in step.
        stockRemaining: Math.max((l.stockTotal || 0) - (l.sold || 0), 0),
      })),
      eligibility: cinema.beverageEligibility,
    });
  } catch (error) {
    console.error("Error listing cinema line-up:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const addLineupItem = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    assertBeverageEligible(cinema, req);

    const { beverage: beverageId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(beverageId)) {
      throw new BadRequestError("A valid beverage id is required");
    }

    // Re-checked against the cinema's own permissions rather than trusting that
    // the picker only offered allowed products — an admin editing a cinema's
    // line-up must not be able to add something that cinema is blocked from.
    const beverage = await Beverage.findOne({
      _id: beverageId,
      ...sellableQuery(cinema),
    }).lean();
    if (!beverage) {
      throw new BadRequestError("That product is not available to this cinema");
    }

    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestError("price must be 0 or more");
    }

    const stockTotal = Number(req.body.stockTotal);
    if (!Number.isInteger(stockTotal) || stockTotal < 0) {
      throw new BadRequestError("stockTotal must be a whole number");
    }

    const item = await CinemaBeverage.create({
      // From the resolved cinema, never the body.
      cinema: cinema._id,
      beverage: beverage._id,
      price,
      stockTotal,
      isAvailable: parseBoolean(req.body.isAvailable, true),
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: item });
  } catch (error) {
    console.error("Error adding cinema line-up item:", error);
    const normalized =
      error?.code === 11000
        ? new BadRequestError("That product is already in this cinema's line-up")
        : error;
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const updateLineupItem = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    assertBeverageEligible(cinema, req);

    // Scoped by cinema in the query itself: another cinema's row does not match,
    // so ownership cannot be forgotten by a later edit to this handler.
    const item = await CinemaBeverage.findOne({
      _id: req.params.itemId,
      cinema: cinema._id,
    });
    if (!item) throw new NotFoundError("That product is not in this line-up");

    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      if (!Number.isFinite(price) || price < 0) {
        throw new BadRequestError("price must be 0 or more");
      }
      // Repricing only affects FUTURE sales: every past sale snapshotted its own
      // unitPrice, so nothing already sold is restated.
      item.price = price;
    }

    if (req.body.stockTotal !== undefined) {
      const stockTotal = Number(req.body.stockTotal);
      if (!Number.isInteger(stockTotal) || stockTotal < 0) {
        throw new BadRequestError("stockTotal must be a whole number");
      }
      if (stockTotal < item.sold) {
        throw new BadRequestError(
          `${item.sold} already sold, so stock cannot be set below that`
        );
      }
      item.stockTotal = stockTotal;
    }

    item.isAvailable = parseBoolean(req.body.isAvailable, item.isAvailable);

    await item.save();
    res.status(StatusCodes.OK).json({ success: true, data: item });
  } catch (error) {
    console.error("Error updating cinema line-up item:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const removeLineupItem = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    assertBeverageEligible(cinema, req);

    const item = await CinemaBeverage.findOne({
      _id: req.params.itemId,
      cinema: cinema._id,
    });
    if (!item) throw new NotFoundError("That product is not in this line-up");

    // A row with sales behind it is withdrawn from sale rather than deleted: the
    // ledger points at it, and a deleted row would strand those sales.
    if (item.sold > 0) {
      item.isAvailable = false;
      await item.save();
      return res.status(StatusCodes.OK).json({
        success: true,
        data: item,
        message:
          "This product has been sold, so it was taken off sale rather than deleted.",
      });
    }

    await item.deleteOne();
    res.status(StatusCodes.OK).json({ success: true, data: { _id: item._id } });
  } catch (error) {
    console.error("Error removing cinema line-up item:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

/** Record a sale at the counter. */
const recordSale = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    assertBeverageEligible(cinema, req);

    const sale = await cinemaBeverageSalesService.recordSale({
      cinemaBeverageId: req.body.cinemaBeverage,
      quantity: req.body.quantity,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      showtimeId: req.body.showtime,
      channel: "manual",
      // The guard that stops a caller recording revenue against a cinema it
      // does not own by passing someone else's line id.
      cinemaId: cinema._id,
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: sale });
  } catch (error) {
    console.error("Error recording cinema beverage sale:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const listSales = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const { page = 1, limit = 25, status, showtimeId, from, to } = req.query;
    const skip = (page - 1) * limit;

    const query = { cinema: cinema._id };
    if (status) query.status = status;
    if (showtimeId) query.showtime = showtimeId;
    if (from || to) {
      query.soldAt = {};
      if (from) query.soldAt.$gte = new Date(from);
      if (to) query.soldAt.$lte = new Date(to);
    }

    const [sales, total] = await Promise.all([
      CinemaBeverageSale.find(query)
        .populate("showtime", "startsAt")
        .sort("-soldAt")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      CinemaBeverageSale.countDocuments(query),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: sales,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error listing cinema beverage sales:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * The concession dashboard: revenue plus what is selling.
 *
 * Revenue comes from getCinemaBeverageRevenue rather than being summed here, so
 * this screen and the finance screen cannot disagree about what a 3% cut means.
 */
const getSalesSummary = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    const [revenue, byProduct] = await Promise.all([
      getCinemaBeverageRevenue(cinema._id, "ETB"),
      CinemaBeverageSale.aggregate([
        { $match: { cinema: cinema._id, status: "confirmed" } },
        {
          $group: {
            _id: "$beverage",
            name: { $first: "$beverageName" },
            category: { $first: "$beverageCategory" },
            unitsSold: { $sum: "$quantity" },
            grossRevenue: { $sum: "$totalAmount" },
          },
        },
        { $sort: { grossRevenue: -1 } },
      ]),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: { revenue, byProduct },
    });
  } catch (error) {
    console.error("Error building cinema beverage summary:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** Admin-only: reverse a sale and return the stock. */
const refundSale = async (req, res) => {
  try {
    const sale = await cinemaBeverageSalesService.refundSale(req.params.saleId, {
      adminId: req.user.userId,
      reason: req.body.reason,
    });
    res.status(StatusCodes.OK).json({ success: true, data: sale });
  } catch (error) {
    console.error("Error refunding cinema beverage sale:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

/** What a customer can buy at this cinema's counter. */
const listPublicLineup = async (req, res) => {
  try {
    const { cinemaId } = req.params;
    const lineup = await CinemaBeverage.find({
      cinema: cinemaId,
      isAvailable: true,
    })
      .populate("beverage", "name image color category isActive")
      .lean();

    res.status(StatusCodes.OK).json({
      success: true,
      data: lineup
        .filter((l) => l.beverage?.isActive)
        .filter((l) => (l.stockTotal || 0) - (l.sold || 0) > 0)
        .map((l) => ({
          _id: l._id,
          beverage: l.beverage,
          price: l.price,
          currency: l.currency,
          // Availability without exposing the sales figures behind it.
          inStock: true,
        })),
    });
  } catch (error) {
    console.error("Error listing public cinema line-up:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list concessions",
    });
  }
};

module.exports = {
  listSellableCatalog,
  listLineup,
  addLineupItem,
  updateLineupItem,
  removeLineupItem,
  recordSale,
  listSales,
  getSalesSummary,
  refundSale,
  listPublicLineup,
};
