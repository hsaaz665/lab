const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

{% if values.database == "mongodb" %}
const mongoose = require('mongoose');
{% elif values.database == "postgresql" or values.database == "mysql" %}
const knex = require('knex');
const dbConfig = require('./config/database');
{% endif %}

const app = express();
const PORT = process.env.PORT || ${{ values.port }};

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

{% if values.database == "mongodb" %}
// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/${{ values.name }}');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

connectDB();
{% elif values.database == "postgresql" or values.database == "mysql" %}
// Database Connection
const db = knex(dbConfig);

// Test database connection
db.raw('SELECT 1')
  .then(() => {
    console.log('Database connected successfully');
  })
  .catch((error) => {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  });
{% endif %}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ${{ values.name }} API',
    version: '1.0.0',
    description: '${{ values.description }}',
    endpoints: {
      health: '/health',
      api: '/api/v1'
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: '${{ values.name }}',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    {% if values.database == "mongodb" %}
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    {% elif values.database == "postgresql" or values.database == "mysql" %}
    database: 'connected' // You can add actual DB health check here
    {% endif %}
  });
});

// API Routes
app.use('/api/v1', require('./routes/api'));

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  {% if values.database == "mongodb" %}
  mongoose.connection.close(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
  {% elif values.database == "postgresql" or values.database == "mysql" %}
  db.destroy(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
  {% endif %}
});

app.listen(PORT, () => {
  console.log(`🚀 ${{ values.name }} server running on port ${PORT}`);
  console.log(`📚 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API: http://localhost:${PORT}/api/v1`);
});
