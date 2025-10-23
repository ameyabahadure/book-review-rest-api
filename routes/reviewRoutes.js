const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Review = require('../models/Review');
const Book = require('../models/Book');

// Validation middleware
const validateReview = [
  body('book').isMongoId().withMessage('Valid book ID is required'),
  body('reviewerName').notEmpty().withMessage('Reviewer name is required').trim().isLength({ min: 2, max: 100 }),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('reviewText').notEmpty().withMessage('Review text is required').trim().isLength({ min: 10, max: 2000 })
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Helper function to update book rating
const updateBookRating = async (bookId) => {
  const reviews = await Review.find({ book: bookId });
  
  if (reviews.length === 0) {
    await Book.findByIdAndUpdate(bookId, {
      averageRating: 0,
      numberOfReviews: 0
    });
    return;
  }
  
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;
  
  await Book.findByIdAndUpdate(bookId, {
    averageRating: averageRating.toFixed(2),
    numberOfReviews: reviews.length
  });
};

// GET /api/reviews - Get all reviews with optional filtering
router.get('/', async (req, res) => {
  try {
    const { book, rating, sort = 'reviewDate', order = 'desc' } = req.query;
    
    let query = {};
    
    // Apply filters
    if (book) query.book = book;
    if (rating) query.rating = parseInt(rating);
    
    const sortOrder = order === 'asc' ? 1 : -1;
    
    const reviews = await Review.find(query)
      .populate('book', 'title author')
      .sort({ [sort]: sortOrder });
    
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reviews/:id - Get a single review by ID
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid review ID')
], handleValidationErrors, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate('book', 'title author');
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reviews - Create a new review
router.post('/', validateReview, handleValidationErrors, async (req, res) => {
  try {
    // Check if book exists
    const book = await Book.findById(req.body.book);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    const review = new Review(req.body);
    await review.save();
    
    // Update book rating
    await updateBookRating(req.body.book);
    
    const populatedReview = await Review.findById(review._id).populate('book', 'title author');
    
    res.status(201).json(populatedReview);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/reviews/:id - Update a review
router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid review ID'),
  ...validateReview
], handleValidationErrors, async (req, res) => {
  try {
    // Check if book exists
    const book = await Book.findById(req.body.book);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    const oldReview = await Review.findById(req.params.id);
    if (!oldReview) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('book', 'title author');
    
    // Update book rating for old book
    await updateBookRating(oldReview.book);
    
    // Update book rating for new book if book changed
    if (oldReview.book.toString() !== req.body.book) {
      await updateBookRating(req.body.book);
    }
    
    res.json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/reviews/:id - Delete a review
router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid review ID')
], handleValidationErrors, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    const bookId = review.book;
    await Review.findByIdAndDelete(req.params.id);
    
    // Update book rating
    await updateBookRating(bookId);
    
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/reviews/:id/helpful - Increment helpful counter
router.patch('/:id/helpful', [
  param('id').isMongoId().withMessage('Invalid review ID')
], handleValidationErrors, async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpful: 1 } },
      { new: true }
    ).populate('book', 'title author');
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
