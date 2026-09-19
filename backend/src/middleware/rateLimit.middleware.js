import rateLimit from 'express-rate-limit';

const make = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message, details: null },
  });

// 20 attempts per 15 minutes per IP on login/register
export const authLimiter = make(
  15 * 60 * 1000,
  20,
  'Too many attempts. Please try again in a few minutes.'
);

// General limiter, used on heavier routes in later phases
export const apiLimiter = make(60 * 1000, 120, 'Too many requests. Slow down.');