// const express = require('express');
// const router = express.Router();
// const categoryController = require('../controllers/categoryController');

// router.post('/', categoryController.createCategory);
// router.get('/', categoryController.getAllCategories);
// router.get('/:id', categoryController.getCategory);
// router.patch('/:id', categoryController.updateCategory);
// router.delete('/:id', categoryController.deleteCategory);

// module.exports = router; 


const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const upload = require('../middlewares/upload'); // Import directly, not destructured

router.post('/', upload.single('image'), categoryController.createCategory);
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);
router.put('/:id', upload.single('image'), categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
