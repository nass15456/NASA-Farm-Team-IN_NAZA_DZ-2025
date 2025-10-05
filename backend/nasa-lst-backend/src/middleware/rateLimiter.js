const rateLimit = require('express-rate-limit');

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// General API rate limiter
const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many requests from this IP, please try again later.'
);

// Strict rate limiter for data modification
const strictLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes  
  10, // limit each IP to 10 requests per windowMs
  'Too many data modification requests, please try again later.'
);

module.exports = {
  apiLimiter,
  strictLimiter
};
