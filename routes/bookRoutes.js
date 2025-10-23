const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Book = require('../models/Book');
const Review = require('../models/Review');

// Validation middleware
const validateBook = [
  body('title').notEmpty().withMessage('Title is required').trim().isLength({ min: 1, max: 200 }),
  body('author').notEmpty().withMessage('Author is required').trim().isLength({ min: 1, max: 100 }),
  body('isbn').notEmpty().withMessage('ISBN is required').trim(),
  body('publicationYear').isInt({ min: 1000, max: new Date().getFullYear() }).withMessage('Valid publication year is required'),
  body('genre').notEmpty().withMessage('Genre is required').isIn(['Fiction', 'Non-Fiction', 'Science Fiction', 'Fantasy', 'Mystery', 'Thriller', 'Romance', 'Horror', 'Biography', 'History', 'Science', 'Self-Help', 'Other'])
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/books - Get all books with optional filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { genre, author, search, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    let query = {};
    
    // Apply filters
    if (genre) query.genre = genre;
    if (author) query.author = new RegExp(author, 'i');
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { author: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'asc' ? 1 : -1;
    
    const books = await Book.find(query)
      .sort({ [sortBy]: sortOrder })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Book.countDocuments(query);
    
    res.json({
      books,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/books/:id - Get a single book by ID
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid book ID')
], handleValidationErrors, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/books - Create a new book
router.post('/', validateBook, handleValidationErrors, async (req, res) => {
  try {
    const book = new Book(req.body);
    await book.save();
    res.status(201).json(book);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'A book with this ISBN already exists' });
    }
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/books/:id - Update a book
router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid book ID'),
  ...validateBook
], handleValidationErrors, async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    res.json(book);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'A book with this ISBN already exists' });
    }
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/books/:id - Delete a book
router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid book ID')
], handleValidationErrors, async (req, res) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Also delete all reviews for this book
    await Review.deleteMany({ book: req.params.id });
    
    res.json({ message: 'Book and associated reviews deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/books/:id/reviews - Get all reviews for a specific book
router.get('/:id/reviews', [
  param('id').isMongoId().withMessage('Invalid book ID')
], handleValidationErrors, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    const reviews = await Review.find({ book: req.params.id }).sort({ reviewDate: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
