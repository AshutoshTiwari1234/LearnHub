function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: Object.values(error.errors).map((item) => item.message),
    });
  }

  if (error.name === 'CastError' || error.name === 'BSONError') {
    return res.status(400).json({ message: 'Invalid identifier or field value' });
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'A record with these unique values already exists' });
  }

  const status = error.status || 500;
  return res.status(status).json({
    message: status >= 500 ? 'Internal server error' : error.message,
  });
}

module.exports = { notFound, errorHandler };
