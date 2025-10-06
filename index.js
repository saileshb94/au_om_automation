require('dotenv').config();
const express = require('express');

// Import middleware
const corsMiddleware = require('./middleware/corsMiddleware');

// Import route handlers
const OrderProcessingRoutes = require('./routes/orderProcessingRoutes');

// Import configuration
const { GOPEOPLE_API_URL, AUSPOST_CREDENTIALS } = require('./config');

// Import SQL scripts
const ordersScript = require('./scripts/orders');
const personalizedScript = require('./scripts/personalized');
const packingMessageScript = require('./scripts/packing-message');
const gopeopleScript = require('./scripts/gopeople');
const auspostScript = require('./scripts/auspost');
const fosUpdateScript = require('./scripts/FOS_update');

const app = express();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
};

// GoPeople API configuration
const gopeopleConfig = {
  token: process.env.GOPEOPLE_API_TOKEN,
  url: GOPEOPLE_API_URL
};

// Auspost API configuration - dual credentials for LVLY and Bloomeroo
const auspostConfig = {
  lvly: AUSPOST_CREDENTIALS.LVLY,
  bloomeroo: AUSPOST_CREDENTIALS.BLOOMEROO
};

// Script configuration
const SCRIPTS_CONFIG = {
  orders: {
    name: 'Orders Report',
    scriptModule: ordersScript,
    isPrerequisite: true
  },
  gopeople: {
    name: 'GoPeople Logistics API',
    scriptModule: gopeopleScript,
    requiresOrders: true,
    requiresApiCalls: true
  },
  auspost: {
    name: 'Auspost Logistics API',
    scriptModule: auspostScript,
    requiresOrders: true,
    requiresApiCalls: true
  },
  personalized: {
    name: 'Personalized Products Report',
    scriptModule: personalizedScript,
    requiresOrders: true
  },
  packing_message: {
    name: 'Packing Slip and Message Cards',
    scriptModule: packingMessageScript,
    requiresOrders: true
  },
  fos_update: {
    name: 'FOS Update Script',
    scriptModule: fosUpdateScript,
    requiresOrders: true
  }
};

// Apply CORS middleware
app.use(corsMiddleware);

// Set up routes
OrderProcessingRoutes.createRoutes(app, dbConfig, gopeopleConfig, auspostConfig, SCRIPTS_CONFIG);

// Start the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});