const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: [true, 'Book reference is required']
  },
  reviewerName: {
    type: String,
    required: [true, 'Reviewer name is required'],
    trim: true,
    minlength: [2, 'Reviewer name must be at least 2 characters long'],
    maxlength: [100, 'Reviewer name cannot exceed 100 characters']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    validate: {
      validator: Number.isInteger,
      message: 'Rating must be an integer'
    }
  },
  reviewText: {
    type: String,
    required: [true, 'Review text is required'],
    trim: true,
    minlength: [10, 'Review must be at least 10 characters long'],
    maxlength: [2000, 'Review cannot exceed 2000 characters']
  },
  reviewDate: {
    type: Date,
    default: Date.now
  },
  helpful: {
    type: Number,
    default: 0,
    min: 0
  },
  verified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for better query performance
reviewSchema.index({ book: 1, rating: -1 });
reviewSchema.index({ reviewDate: -1 });

// Virtual for formatted date
reviewSchema.virtual('formattedDate').get(function() {
  return this.reviewDate.toLocaleDateString();
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
