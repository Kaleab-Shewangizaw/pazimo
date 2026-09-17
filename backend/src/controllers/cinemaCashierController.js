const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");
const { BadRequestError, NotFoundError } = require("../errors");
const { resolveCinema } = require("../utils/cinemaAccess");

// Cashier accounts for the cinema channel — a cinema's own counter staff.
//
// Every handler resolves its cinema through resolveCinema (utils/cinemaAccess),
// exactly like every other cinema controller, so ONE implementation serves
// both the owner's /me/cashiers path and admin's /admin/:cinemaId/cashiers
// path. Deliberately NOT reachable by a cashier itself — these routes are
// wired under cinemaSelf/adminOnly in cinemaRoutes.js, never cinemaStaff, so a
// cashier can never create or manage other cashiers.

const normalizeText = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

// GET /me/cashiers, GET /admin/:cinemaId/cashiers
const listCashiers = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const cashiers = await User.find({
      role: "cashier",
      cinema: cinema._id,
    })
      .select("-password")
      .sort("-createdAt");

    res.status(StatusCodes.OK).json({ status: "success", data: cashiers });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ status: "error", message: error.message });
  }
};

// POST /me/cashiers, POST /admin/:cinemaId/cashiers
const createCashier = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

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

    // Plain password straight to User.create, same as cinemaController's
    // createCinema does for the owner login itself — the pre-save bcrypt
    // hook on the User model hashes it before it ever hits the database.
    const cashier = await User.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      role: "cashier",
      cinema: cinema._id,
    });
    cashier.password = undefined;

    res.status(StatusCodes.CREATED).json({ status: "success", data: cashier });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ status: "error", message: error.message });
  }
};

// PATCH /me/cashiers/:cashierId, PATCH /admin/:cinemaId/cashiers/:cashierId
const updateCashier = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    // Scoped by cinema in the query itself — same ownership-in-the-query
    // pattern cinemaBeverageController.updateLineupItem uses — so one cinema
    // can never edit another's cashier even if a route is mis-wired later.
    const cashier = await User.findOne({
      _id: req.params.cashierId,
      role: "cashier",
      cinema: cinema._id,
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

// DELETE /me/cashiers/:cashierId, DELETE /admin/:cinemaId/cashiers/:cashierId
//
// Soft-delete only: CinemaTicket.checkedInBy and CinemaBeverageSale.redeemedBy
// both `ref: "User"` and point at whichever account handled that past
// transaction. Hard-deleting the cashier would strand those refs (or null
// them out on a populate), erasing who actually checked a ticket in or
// redeemed a sale. isActive:false keeps the account (and its history) intact
// while blocking sign-in via requireCinemaAccount/requireVenueAccount's
// isActive check, same as suspending any other account on this platform.
const deleteCashier = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    const cashier = await User.findOne({
      _id: req.params.cashierId,
      role: "cashier",
      cinema: cinema._id,
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
