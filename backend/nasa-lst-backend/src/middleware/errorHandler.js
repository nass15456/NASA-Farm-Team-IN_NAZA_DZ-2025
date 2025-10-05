const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.stack);

  // Default error
  let error = { ...err };
  error.message = err.message;

  // PostgreSQL errors
  if (err.code === '23505') {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // PostgreSQL constraint errors
  if (err.code === '23503') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // PostgreSQL validation errors
  if (err.code === '22P02') {
    const message = 'Invalid input syntax';
    error = { message, statusCode: 400 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error'
  });
};

module.exports = errorHandler;
