import express from 'express';
const router = express.Router();

/**
 * @route   GET /api/diagnostics
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: {
      connected: !!process.env.MONGODB_URI
    },
    api: {
      gemini: !!process.env.GEMINI_API_KEY
    }
  });
});

export default router;
