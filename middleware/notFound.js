/**
 * Middleware to handle 404 routes
 * This ensures we return JSON for API routes that don't exist
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.originalUrl}`
  });
};

export default notFound;
