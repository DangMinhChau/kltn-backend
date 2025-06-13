const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Enable CORS
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || 'https://your-frontend-url.vercel.app',
      'http://localhost:3000',
      'https://localhost:3000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  }),
);

// Parse JSON bodies
app.use(express.json());

// Serve static files
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'E-Commerce Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// API root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 E-Commerce Backend API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      docs: '/api/docs (coming soon)',
      api: '/api',
    },
  });
});

// Catch all API routes
app.all('/api/*', (req, res) => {
  res.status(503).json({
    message: 'NestJS API is temporarily unavailable',
    status: 'Service Unavailable',
    timestamp: new Date().toISOString(),
    note: 'Full NestJS API will be available soon',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    availableRoutes: ['/', '/health', '/api/*'],
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'Something went wrong',
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;
