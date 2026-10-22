const express = require('express');
const cors = require('cors');

const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const logger = require('./utils/logger');

const app = express();

app.use((req, res, next) => {
  console.log(req.method, req.url, req.headers['content-length'], req.headers['content-type']);
  next();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lightweight request logger
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.originalUrl}`);
  next();
});

const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', routes);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler - must be registered last
app.use(errorHandler);

module.exports = app;
