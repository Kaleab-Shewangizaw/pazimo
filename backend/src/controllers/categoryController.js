// const Category = require('../models/Category');
// const { StatusCodes } = require('http-status-codes');
// const { BadRequestError, NotFoundError } = require('../errors');

// // Create category
// const createCategory = async (req, res) => {
//   const { name, description, isPublished } = req.body;

//   const category = await Category.create({
//     name,
//     description,
//     isPublished
//   });

//   res.status(StatusCodes.CREATED).json({
//     status: 'success',
//     data: { category }
//   });
// };

// // Get all categories
// const getAllCategories = async (req, res) => {
//   const categories = await Category.find().sort('name');
  
//   res.status(StatusCodes.OK).json({
//     status: 'success',
//     data: categories
//   });
// };

// // Get single category
// const getCategory = async (req, res) => {
//   const { id: categoryId } = req.params;
  
//   const category = await Category.findById(categoryId);
  
//   if (!category) {
//     throw new NotFoundError(`No category with id ${categoryId}`);
//   }
  
//   res.status(StatusCodes.OK).json({
//     status: 'success',
//     data: { category }
//   });
// };

// // Update category
// const updateCategory = async (req, res) => {
//   const { id: categoryId } = req.params;
//   const { name, description, isPublished } = req.body;
  
//   const category = await Category.findById(categoryId);
  
//   if (!category) {
//     throw new NotFoundError(`No category with id ${categoryId}`);
//   }

//   category.name = name || category.name;
//   category.description = description || category.description;
//   category.isPublished = isPublished !== undefined ? isPublished : category.isPublished;

//   await category.save();
  
//   res.status(StatusCodes.OK).json({
//     status: 'success',
//     data: { category }
//   });
// };

// // Delete category
// const deleteCategory = async (req, res) => {
//   const { id: categoryId } = req.params;
  
//   const category = await Category.findByIdAndDelete(categoryId);
  
//   if (!category) {
//     throw new NotFoundError(`No category with id ${categoryId}`);
//   }
  
//   res.status(StatusCodes.OK).json({
//     status: 'success',
//     message: 'Category deleted successfully'
//   });
// };

// module.exports = {
//   createCategory,
//   getAllCategories,
//   getCategory,
//   updateCategory,
//   deleteCategory
// }; 


const Category = require('../models/Category');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, NotFoundError } = require('../errors');

// Create category
const createCategory = async (req, res) => {
  const { name, description, isPublished } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  const category = await Category.create({
    name,
    description,
    image,
    isPublished
  });

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: { category }
  });
};

// Update category
const updateCategory = async (req, res) => {
  const { id: categoryId } = req.params;
  const { name, description, isPublished } = req.body;
  
  const category = await Category.findById(categoryId);
  
  if (!category) {
    throw new NotFoundError(`No category with id ${categoryId}`);
  }

  category.name = name || category.name;
  category.description = description || category.description;
  category.isPublished = isPublished !== undefined ? isPublished : category.isPublished;
  
  // Update image if new file uploaded
  if (req.file) {
    category.image = `/uploads/${req.file.filename}`;
  }

  await category.save();
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { category }
  });
};

// Get all categories, Get single category, Delete category remain the same...
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
