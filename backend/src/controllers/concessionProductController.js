const fs = require("fs");
const path = require("path");
const { StatusCodes } = require("http-status-codes");
const ConcessionProduct = require("../models/ConcessionProduct");
const Cinema = require("../models/Cinema");
const { BadRequestError, NotFoundError } = require("../errors");

// The cinema channel's product catalogue — what a cinema counter can sell.
// Admin-only, and deliberately its own surface rather than a filtered view of
// the event/venue beverages admin: the two catalogues share no data, so there
// is nothing to filter — see models/ConcessionProduct for why.

const UPLOADS_DIR = path.join(__dirname, "../../uploads");

const normalizeText = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

// Best-effort cleanup of a replaced/deleted local upload. Never throws: a
// leftover file is untidy, a failed request because of one is worse.
const removeUploadedImage = (imagePath) => {
  if (!imagePath || typeof imagePath !== "string") return;
  const filename = path.basename(imagePath);
  if (!filename || filename === "." || filename === "..") return;

  fs.unlink(path.join(UPLOADS_DIR, filename), (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Failed to remove concession product image:", error.message);
    }
  });
};

const parseColor = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === "null") return null;
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    throw new BadRequestError("color must be a hex value like #1f7a3f");
  }
  return value.trim().toLowerCase();
};

const CATEGORIES = ["drink", "snack", "combo"];
const parseCategory = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!CATEGORIES.includes(normalized)) {
    throw new BadRequestError(`category must be one of: ${CATEGORIES.join(", ")}`);
  }
  return normalized;
};

const duplicateNameError = (error) =>
  error?.code === 11000
    ? new BadRequestError("A product with this name already exists")
    : error;

const listProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, category } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.name = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;
    if (category) query.category = parseCategory(category);

    const [products, total, activeCount, inactiveCount] = await Promise.all([
      ConcessionProduct.find(query).sort("name").skip(skip).limit(Number(limit)).lean(),
      ConcessionProduct.countDocuments(query),
      ConcessionProduct.countDocuments({ isActive: true }),
      ConcessionProduct.countDocuments({ isActive: false }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: products,
      stats: { active: activeCount, inactive: inactiveCount, total: activeCount + inactiveCount },
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    console.error("Error listing concession products:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list products",
      error: error.message,
    });
  }
};

const getProduct = async (req, res) => {
  try {
    const product = await ConcessionProduct.findById(req.params.id);
    if (!product) throw new NotFoundError("Product not found");

    res.status(StatusCodes.OK).json({ success: true, data: product });
  } catch (error) {
    console.error("Error getting concession product:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    if (!name) throw new BadRequestError("Product name is required");

    const product = await ConcessionProduct.create({
      name,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      color: parseColor(req.body.color) ?? null,
      category: parseCategory(req.body.category) ?? "snack",
      isActive: parseBoolean(req.body.isActive, true),
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: product });
  } catch (error) {
    console.error("Error creating concession product:", error);
    // The upload already landed on disk before validation ran — don't leave it
    // behind for a product that was never created.
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized = duplicateNameError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await ConcessionProduct.findById(req.params.id);
    if (!product) throw new NotFoundError("Product not found");

    const name = normalizeText(req.body.name);
    if (req.body.name !== undefined && !name) {
      throw new BadRequestError("Product name cannot be empty");
    }
    if (name) product.name = name;

    product.isActive = parseBoolean(req.body.isActive, product.isActive);

    const color = parseColor(req.body.color);
    if (color !== undefined) product.color = color;

    const category = parseCategory(req.body.category);
    if (category !== undefined) product.category = category;

    const previousImage = product.image;
    if (req.file) product.image = `/uploads/${req.file.filename}`;

    product.updatedBy = req.user.userId;
    await product.save();

    if (req.file && previousImage && previousImage !== product.image) {
      removeUploadedImage(previousImage);
    }

    res.status(StatusCodes.OK).json({ success: true, data: product });
  } catch (error) {
    console.error("Error updating concession product:", error);
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized = duplicateNameError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

// Dedicated activate/deactivate endpoint so the list can toggle a product
// without resubmitting the whole (multipart) form.
const setProductStatus = async (req, res) => {
  try {
    const isActive = parseBoolean(req.body.isActive, undefined);
    if (isActive === undefined) {
      throw new BadRequestError("isActive must be true or false");
    }

    const product = await ConcessionProduct.findById(req.params.id);
    if (!product) throw new NotFoundError("Product not found");

    product.isActive = isActive;
    product.updatedBy = req.user.userId;
    await product.save();

    res.status(StatusCodes.OK).json({ success: true, data: product });
  } catch (error) {
    console.error("Error updating concession product status:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// Hard delete, matching how the beverage catalogue removes a row. Refuses one
// that any cinema still sells — see CinemaBeverage — rather than orphaning
// that line-up's reference to it.
const deleteProduct = async (req, res) => {
  try {
    const CinemaBeverage = require("../models/CinemaBeverage");
    const inUse = await CinemaBeverage.exists({ beverage: req.params.id });
    if (inUse) {
      throw new BadRequestError(
        "This product is on at least one cinema's line-up. Remove it there first, or retire it instead of deleting it."
      );
    }

    const product = await ConcessionProduct.findByIdAndDelete(req.params.id);
    if (!product) throw new NotFoundError("Product not found");

    // Drop it from every cinema's allow list too. A dangling id would grant
    // nothing, but it would inflate the "N granted" count an admin sees.
    await Cinema.updateMany(
      { allowedConcessions: product._id },
      { $pull: { allowedConcessions: product._id } }
    );

    removeUploadedImage(product.image);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting concession product:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  setProductStatus,
  deleteProduct,
};
