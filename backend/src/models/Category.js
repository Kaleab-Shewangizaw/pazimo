// const mongoose = require('mongoose');

// const categorySchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: [true, 'Category name is required'],
//     unique: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     required: [true, 'Category description is required'],
//     trim: true
//   },
//   isPublished: {
//     type: Boolean,
//     default: true
//   }
// }, {
//   timestamps: true
// });

// module.exports = mongoose.model('Category', categorySchema); 


const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Category description is required'],
    trim: true
  },
  image: {
    type: String,
    default: null
  },
  isPublished: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);
