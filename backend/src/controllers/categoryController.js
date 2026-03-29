const Category = require('../models/Category');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, NotFoundError } = require('../errors');

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return fallback;
};

const normalizeText = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

// Create category
const createCategory = async (req, res) => {
  const name = normalizeText(req.body.name);
  const description = normalizeText(req.body.description);

  if (!name || !description) {
    throw new BadRequestError('Category name and description are required');
  }

  const image = req.file ? `/uploads/${req.file.filename}` : null;

  let category;
  try {
    category = await Category.create({
      name,
      description,
      image,
      isPublished: parseBoolean(req.body.isPublished, true),
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new BadRequestError('Category name already exists');
    }

    throw error;
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: { category }
  });
};

// Update category
const updateCategory = async (req, res) => {
  const { id: categoryId } = req.params;
  
  const category = await Category.findById(categoryId);
  
  if (!category) {
    throw new NotFoundError(`No category with id ${categoryId}`);
  }

  const name = normalizeText(req.body.name);
  const description = normalizeText(req.body.description);

  if (name !== undefined) {
    category.name = name;
  }

  if (description !== undefined) {
    category.description = description;
  }

  category.isPublished = parseBoolean(req.body.isPublished, category.isPublished);
  
  // Update image if new file uploaded
  if (req.file) {
    category.image = `/uploads/${req.file.filename}`;
  }

  try {
    await category.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new BadRequestError('Category name already exists');
    }

    throw error;
  }
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { category }
  });
};

const getAllCategories = async (req, res) => {
  const categories = await Category.find().sort('name');
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: categories
  });
};

const getCategory = async (req, res) => {
  const { id: categoryId } = req.params;
  
  const category = await Category.findById(categoryId);
  
  if (!category) {
    throw new NotFoundError(`No category with id ${categoryId}`);
  }
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { category }
  });
};

const deleteCategory = async (req, res) => {
  const { id: categoryId } = req.params;
  
  const category = await Category.findByIdAndDelete(categoryId);
  
  if (!category) {
    throw new NotFoundError(`No category with id ${categoryId}`);
  }
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Category deleted successfully'
  });
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategory,
  updateCategory,
  deleteCategory
};
