const fs = require("fs");
const path = require("path");
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

// The same definitions beverageController uses for the platform catalogue.
//
// Duplicated rather than imported because beverageController does not export
// them, and a cinema adding a product must be validated EXACTLY as an admin
// adding one — a second, subtly different notion of "a valid colour" would show
// up later as two products that look identical and behave differently.
const normalizeText = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const UPLOADS_DIR = path.join(__dirname, "../../uploads");

const removeUploadedImage = (imagePath) => {
  if (!imagePath || typeof imagePath !== "string") return;
  const filename = path.basename(imagePath);
  if (!filename || filename === "." || filename === "..") return;
  fs.unlink(path.join(UPLOADS_DIR, filename), (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Failed to remove product image:", error.message);
    }
  });
};

// undefined for "not supplied", null for "explicitly cleared", so an update can
// tell the two apart.
const parseColor = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === "null") return null;
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    throw new BadRequestError("color must be a hex value like #1f7a3f");
  }
  return value.trim().toLowerCase();
};

// Rejected rather than silently defaulted: an operator who typed "snacks" needs
// to be told, not have it filed as a drink and reported in the wrong group.
const CATEGORIES = ["drink", "snack", "combo"];
const parseCategory = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!CATEGORIES.includes(normalized)) {
    throw new BadRequestError(`category must be one of: ${CATEGORIES.join(", ")}`);
  }
  return normalized;
};

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
/**
 * What this cinema may put on its counter.
 *
 * The platform catalogue plus anything this cinema added itself, minus anything
 * an admin has blocked for them. `ownerCinema: null` also matches rows written
 * before ownership existed, which is what makes every legacy product platform-
 * wide rather than invisible.
 *
 * Another cinema's own products are never in this list — not filtered out
 * afterwards, but never selected, so no later edit can leak them.
 */
const sellableQuery = (cinema) => {
  const blocked = cinema?.blockedBeverages || [];
  const query = {
    isActive: true,
    $or: [{ ownerCinema: null }, { ownerCinema: cinema._id }],
  };
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
      Beverage.find(query).select("name image color category ownerCinema").sort("name").lean(),
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
        // Whether this cinema may edit or remove it. A platform product is the
        // admin's; only what the cinema added is theirs to change.
        isOwn: String(b.ownerCinema || "") === String(cinema._id),
      })),
    });
  } catch (error) {
    console.error("Error listing cinema catalogue:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Add a product this cinema sells that the platform catalogue does not have.
 *
 * Owned by the cinema, so it never appears in another cinema's picker and never
 * touches the platform list. Admins still see it, can deactivate it, and can
 * block it for this cinema — control without standing between an operator and
 * their own till.
 */
const createOwnProduct = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    assertBeverageEligible(cinema, req);

    const name = normalizeText(req.body.name);
    if (!name) throw new BadRequestError("Give the product a name");

    // Refused against everything this cinema can already SEE, not just what it
    // owns. Letting a cinema add its own "Coke" while the platform already
    // offers one would put two identical rows in their picker with no way to
    // tell them apart.
    const clash = await Beverage.findOne({
      name,
      $or: [{ ownerCinema: null }, { ownerCinema: cinema._id }],
    })
      .collation({ locale: "en", strength: 2 })
      .lean();
    if (clash) {
      throw new BadRequestError(
        clash.ownerCinema
          ? `You already have a product called "${clash.name}"`
          : `"${clash.name}" is already in the platform catalogue — add it from there`
      );
    }

    const product = await Beverage.create({
      name,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      color: parseColor(req.body.color) ?? null,
      category: parseCategory(req.body.category) ?? "drink",
      isActive: true,
      // From the resolved cinema, never the body — a cinema cannot create a
      // product owned by someone else.
      ownerCinema: cinema._id,
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: product });
  } catch (error) {
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized =
      error?.code === 11000
        ? new BadRequestError("You already have a product with that name")
        : error;
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error creating cinema product:", error);
    res.status(status).json({ success: false, message: normalized.message });
  }
};

/** Rename or restyle a product this cinema owns. */
const updateOwnProduct = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    assertBeverageEligible(cinema, req);

    // Ownership is part of the QUERY, so a platform product or another
    // cinema's simply does not match — the check cannot be forgotten by a
    // later edit to this handler.
    const product = await Beverage.findOne({
      _id: req.params.productId,
      ownerCinema: cinema._id,
    });
    if (!product) {
      throw new NotFoundError("That product is not one you added");
    }

    const name = normalizeText(req.body.name);
    if (req.body.name !== undefined && !name) {
      throw new BadRequestError("A product needs a name");
    }
    if (name) product.name = name;

    const color = parseColor(req.body.color);
    if (color !== undefined) product.color = color;

    const category = parseCategory(req.body.category);
    if (category !== undefined) product.category = category;

    const previousImage = product.image;
    if (req.file) product.image = `/uploads/${req.file.filename}`;

    product.updatedBy = req.user.userId;
    await product.save();

    // Only once the save succeeded, so a failed rename does not delete the
    // picture of a product that still exists.
    if (req.file && previousImage) removeUploadedImage(previousImage);

    res.status(StatusCodes.OK).json({ success: true, data: product });
  } catch (error) {
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized =
      error?.code === 11000
        ? new BadRequestError("You already have a product with that name")
        : error;
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error updating cinema product:", error);
    res.status(status).json({ success: false, message: normalized.message });
  }
};

/**
 * Retire a product this cinema added.
 *
 * Deactivated rather than deleted when it has ever been sold: the sales ledger
 * references it, and a deleted row would leave past revenue pointing at
 * nothing. A product that never sold anything is genuinely removed, because
 * keeping a typo around for ever helps nobody.
 */
const removeOwnProduct = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    assertBeverageEligible(cinema, req);

    const product = await Beverage.findOne({
      _id: req.params.productId,
      ownerCinema: cinema._id,
    });
    if (!product) {
      throw new NotFoundError("That product is not one you added");
    }

    const sold = await CinemaBeverageSale.countDocuments({
      beverage: product._id,
    });

    if (sold > 0) {
      product.isActive = false;
      product.updatedBy = req.user.userId;
      await product.save();
      // The line-up row goes too, or the counter keeps offering it.
      await CinemaBeverage.deleteOne({ cinema: cinema._id, beverage: product._id });
      return res.status(StatusCodes.OK).json({
        success: true,
        message: `${product.name} has been retired. Its ${sold} past sale${sold === 1 ? "" : "s"} stay in your records.`,
      });
    }

    await CinemaBeverage.deleteOne({ cinema: cinema._id, beverage: product._id });
    await Beverage.deleteOne({ _id: product._id });
    if (product.image) removeUploadedImage(product.image);

    res.status(StatusCodes.OK).json({
      success: true,
      message: `${product.name} removed.`,
    });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error removing cinema product:", error);
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
        //
        // null on an unlimited line rather than a big number, so a client cannot
        // render "9999 left" and cannot compare it to decide something is
        // running low. "We do not count this" has no numeric answer.
        stockRemaining: l.unlimitedStock
          ? null
          : Math.max((l.stockTotal || 0) - (l.sold || 0), 0),
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

    // An unlimited line is not counted, so it does not need a stock figure —
    // requiring one anyway would make the caller invent a number that means
    // nothing and that a later reader might trust.
    const unlimitedStock = parseBoolean(req.body.unlimitedStock, false);

    let stockTotal = 0;
    if (!unlimitedStock) {
      stockTotal = Number(req.body.stockTotal);
      if (!Number.isInteger(stockTotal) || stockTotal < 0) {
        throw new BadRequestError("stockTotal must be a whole number");
      }
    }

    const item = await CinemaBeverage.create({
      // From the resolved cinema, never the body.
      cinema: cinema._id,
      beverage: beverage._id,
      price,
      stockTotal,
      unlimitedStock,
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

    if (req.body.unlimitedStock !== undefined) {
      item.unlimitedStock = parseBoolean(req.body.unlimitedStock, item.unlimitedStock);
    }

    if (req.body.stockTotal !== undefined) {
      const stockTotal = Number(req.body.stockTotal);
      if (!Number.isInteger(stockTotal) || stockTotal < 0) {
        throw new BadRequestError("stockTotal must be a whole number");
      }
      // Only enforced on a counted line, because stockTotal is ignored entirely
      // while a line is unlimited.
      //
      // stockTotal is CUMULATIVE — everything ever put up for sale, with
      // remaining derived as stockTotal - sold — so it can never be below what
      // has already gone. That bites hardest when switching a line back from
      // unlimited, where `sold` may be large and the operator is thinking in
      // "how many do I have today", so the message says which number to enter
      // rather than only refusing.
      if (!item.unlimitedStock && stockTotal < item.sold) {
        throw new BadRequestError(
          `${item.sold} have already been sold. stockTotal counts everything ever ` +
            `stocked, not what is left — to have ${stockTotal} available now, ` +
            `set it to ${item.sold + stockTotal}.`
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

/**
 * Mark a pre-bought item handed over.
 *
 * Cinema staff, not admin: this is a counter action performed while the
 * customer is standing there, and routing it through an admin would make
 * collecting popcorn slower than buying it.
 */
const redeemSale = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const sale = await cinemaBeverageSalesService.redeemSale({
      saleId: req.params.saleId,
      cinemaId: cinema._id,
      redeemedBy: req.user.userId,
    });
    res.status(StatusCodes.OK).json({ success: true, data: sale });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error redeeming concession:", error);
    res.status(status).json({ success: false, message: error.message });
  }
};

/** What one order still owes a customer at the counter. */
const listOutstandingForOrder = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const items = await cinemaBeverageSalesService.listOutstandingForOrder({
      paymentReference: req.params.reference,
      cinemaId: cinema._id,
    });
    res.status(StatusCodes.OK).json({ success: true, data: items });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error listing outstanding concessions:", error);
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
  createOwnProduct,
  updateOwnProduct,
  removeOwnProduct,
  listLineup,
  addLineupItem,
  updateLineupItem,
  removeLineupItem,
  recordSale,
  listSales,
  getSalesSummary,
  redeemSale,
  listOutstandingForOrder,
  refundSale,
  listPublicLineup,
};
