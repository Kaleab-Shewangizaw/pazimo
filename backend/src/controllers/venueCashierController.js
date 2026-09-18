const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");
const { BadRequestError, NotFoundError } = require("../errors");
const { resolveVenueContext } = require("./venueController");

// Cashier accounts for the venue channel — a venue's own counter staff.
// Mirror of cinemaCashierController.js; see that file's header for the shared
// reasoning. Every handler resolves its venue through resolveVenueContext
// (venueController.js), which already trusts req.venue (set by
// requireVenueAccount) for a venue caller and the :venueId in the URL for an
// admin — so one implementation serves both callers.
//
// Deliberately NOT reachable by a cashier itself — these routes are wired
// under adminOrVenueAccount in venueRoutes.js, which already excludes the
// "cashier" role, so a cashier can never create or manage other cashiers.

const normalizeText = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

// GET /:venueId/cashiers
const listCashiers = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);
    const cashiers = await User.find({
      role: "cashier",
      venue: venue._id,
    })
      .select("-password")
      .sort("-createdAt");

    res.status(StatusCodes.OK).json({ status: "success", data: cashiers });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ status: "error", message: error.message });
  }
};

// POST /:venueId/cashiers
const createCashier = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);

    const firstName = normalizeText(req.body.firstName);
    const lastName = normalizeText(req.body.lastName);
    const email = normalizeText(req.body.email)?.toLowerCase();
    const phoneNumber = normalizeText(req.body.phoneNumber);
    const password = req.body.password;

    if (!firstName || !email || !phoneNumber || !password) {
      throw new BadRequestError(
        "firstName, email, phoneNumber and password are required"
      );
    }
    if (String(password).length < 6) {
      throw new BadRequestError("Password must be at least 6 characters");
    }

    const existing = await User.findOne({ email });
    if (existing) {
      throw new BadRequestError("An account with this email already exists");
    }

    // Plain password straight to User.create — the pre-save bcrypt hook on
    // the User model hashes it before it ever hits the database, same as
    // cinemaCashierController.createCashier and cinemaController.createCinema.
    const cashier = await User.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      role: "cashier",
      venue: venue._id,
    });
    cashier.password = undefined;

    res.status(StatusCodes.CREATED).json({ status: "success", data: cashier });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ status: "error", message: error.message });
  }
};

// PATCH /:venueId/cashiers/:cashierId
const updateCashier = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);

    // Scoped by venue in the query itself, same ownership-in-the-query
    // pattern the cinema side uses, so one venue can never edit another's
    // cashier even if a route is mis-wired later.
    const cashier = await User.findOne({
      _id: req.params.cashierId,
      role: "cashier",
      venue: venue._id,
    });
    if (!cashier) throw new NotFoundError("Cashier not found");

    const firstName = normalizeText(req.body.firstName);
    if (firstName !== undefined) cashier.firstName = firstName;

    if (req.body.lastName !== undefined) {
      cashier.lastName = normalizeText(req.body.lastName) || "";
    }

    const phoneNumber = normalizeText(req.body.phoneNumber);
    if (phoneNumber !== undefined) cashier.phoneNumber = phoneNumber;

    if (req.body.isActive !== undefined) {
      cashier.isActive = req.body.isActive === true || req.body.isActive === "true";
    }

    await cashier.save();
    cashier.password = undefined;

    res.status(StatusCodes.OK).json({ status: "success", data: cashier });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ status: "error", message: error.message });
  }
};

// DELETE /:venueId/cashiers/:cashierId
//
// Soft-delete only, same reasoning as the cinema side: past
// VenueBeverageSale rows may reference this account (redeemedBy/soldBy-style
// fields, ref: "User"), so hard-deleting would strand or null those refs.
// isActive:false keeps the account and its history intact while blocking
// sign-in via requireVenueAccount's isActive check.
const deleteCashier = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);

    const cashier = await User.findOne({
      _id: req.params.cashierId,
      role: "cashier",
      venue: venue._id,
    });
    if (!cashier) throw new NotFoundError("Cashier not found");

    cashier.isActive = false;
    await cashier.save();

    res.status(StatusCodes.OK).json({
      status: "success",
      message: "Cashier deactivated",
    });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ status: "error", message: error.message });
  }
};

module.exports = {
  listCashiers,
  createCashier,
  updateCashier,
  deleteCashier,
};
