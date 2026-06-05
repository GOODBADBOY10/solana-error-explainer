import { logger } from '../services/logger.js';

export function errorHandler(err, req, res, _next) {
  logger.error(`${err.message} - ${req.method} ${req.path}`, { stack: err.stack });

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  const isDev = process.env.NODE_ENV === 'development';

  return res.status(err.status || 500).json({
    error: isDev ? err.message : 'An internal server error occurred',
    ...(isDev && { stack: err.stack }),
  });
}