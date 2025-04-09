/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  // Check if headers have been sent
  if (res.headersSent) {
    return next(err);
  }

  // Default error message and status
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // Return JSON error instead of HTML
  return res.status(statusCode).json({
    success: false,
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

export default errorHandler;
