const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const upload = require('../middlewares/upload');

router.post('/', upload.single('image'), categoryController.createCategory);
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);
router.patch('/:id', upload.single('image'), categoryController.updateCategory);
router.put('/:id', upload.single('image'), categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
