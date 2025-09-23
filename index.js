require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const { Firestore } = require('@google-cloud/firestore'); // Add this to package.json
const GoogleDriveService = require('./gdrive-service');


const app = express();

// Initialize Firestore
const firestore = new Firestore();
const BATCH_COLLECTION = 'batch_counters';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306
};

// GoPeople API configuration
const GOPEOPLE_API_TOKEN = process.env.GOPEOPLE_API_TOKEN;
const GOPEOPLE_API_URL = process.env.GOPEOPLE_API_URL || 'http://api-demo.gopeople.com.au/book/instant';

// Import SQL scripts
const ordersScript = require('./orders');
const personalizedScript = require('./personalized');
const packingMessageScript = require('./packing-message'); // NEW IMPORT
const gopeopleScript = require('./gopeople');
const fosUpdateScript = require('./FOS_update');

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
  personalized: {
    name: 'Personalized Products Report',
    scriptModule: personalizedScript,
    requiresOrders: true
  },
  packing_message: { // NEW SCRIPT CONFIG
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

// Location list for batch management
const LOCATIONS = ['Melbourne', 'Sydney', 'Perth', 'Adelaide', 'Brisbane'];

// Firestore batch management functions
async function getBatchNumbers(deliveryDate) {
  console.log(`Fetching batch numbers for date: ${deliveryDate}`);
  const batchNumbers = {};
  
  for (const location of LOCATIONS) {
    const key = `${location}_${deliveryDate}`;
    try {
      const docRef = firestore.collection(BATCH_COLLECTION).doc(key);
      const doc = await docRef.get();
      
      if (doc.exists) {
        batchNumbers[location] = doc.data().batch || 0;
      } else {
        // Create new entry with batch 0
        batchNumbers[location] = 0;
        await docRef.set({ batch: 0, created_at: new Date(), updated_at: new Date() });
      }
    } catch (error) {
      console.error(`Firestore: Error fetching batch for ${location}:`, error.message);
      batchNumbers[location] = null; // Will be handled in batch update logic
    }
  }
  
  console.log('Firestore: Current batch numbers:', batchNumbers);
  return batchNumbers;
}

async function updateBatchNumbers(deliveryDate, locationOrderCounts, currentBatchNumbers) {
  console.log('Firestore: Updating batch numbers based on order counts:', locationOrderCounts);
  const updatedBatchNumbers = { ...currentBatchNumbers };
  
  for (const location of LOCATIONS) {
    const orderCount = locationOrderCounts[location] || 0;
    const currentBatch = currentBatchNumbers[location];
    
    if (currentBatch === null) {
      console.log(`Firestore: Skipping update for ${location} due to previous error`);
      continue;
    }
    
    if (orderCount > 0) {
      // Increment batch number
      const newBatch = currentBatch + 1;
      updatedBatchNumbers[location] = newBatch;
      const key = `${location}_${deliveryDate}`;
      try {
        const docRef = firestore.collection(BATCH_COLLECTION).doc(key);
        await docRef.update({ 
          batch: newBatch, 
          updated_at: new Date(),
          last_order_count: orderCount 
        });
        console.log(`Firestore: Updated batch for ${location}: ${currentBatch} -> ${newBatch} (${orderCount} orders)`);
      } catch (error) {
        console.error(`Firestore: Error updating batch for ${location}:`, error.message);
        updatedBatchNumbers[location] = null;
      }
    } else {
      console.log(`Firestore: No orders for ${location}, keeping batch at ${currentBatch}`);
    }
  }
  
  console.log('Firestore: Final batch numbers:', updatedBatchNumbers);
  return updatedBatchNumbers;
}

// Helper function to parse dev_mode parameter
function parseDevMode(devModeParam) {
  // Default to "11" if not provided or invalid
  const defaultMode = "11";
  
  if (!devModeParam || typeof devModeParam !== 'string' || devModeParam.length !== 2) {
    console.log(`Invalid dev_mode parameter: ${devModeParam}, using default: ${defaultMode}`);
    return defaultMode;
  }
  
  // Validate that both digits are 0 or 1
  if (!/^[01][01]$/.test(devModeParam)) {
    console.log(`Invalid dev_mode format: ${devModeParam}, using default: ${defaultMode}`);
    return defaultMode;
  }
  
  console.log(`Dev mode parsed: ${devModeParam} (gopeople: ${devModeParam[0]}, fos_update: ${devModeParam[1]})`);
  return devModeParam;
}

// Helper function to get Melbourne date in YYYY-MM-DD format
function getMelbourneDate() {
  const now = new Date();
  const melbourneTime = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Melbourne"}));
  return melbourneTime.toISOString().split('T')[0];
}

// Helper function to format date to YYYY-MM-DD
function formatDate(dateInput) {
  if (!dateInput) return getMelbourneDate();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date format: ${dateInput}, using today's date`);
      return getMelbourneDate();
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.warn(`Date parsing error: ${error.message}, using today's date`);
    return getMelbourneDate();
  }
}

// Helper function to build dynamic query
function buildDynamicQuery(baseQuery, params, scriptKey) {
  let query = baseQuery;
  const queryParams = [];
  
  console.log('Building dynamic query for:', scriptKey);
  
  // Handle FOS_update script specially
  if (scriptKey === 'fos_update') {
    if (params.orderNumbers && params.orderNumbers.length > 0) {
      const orderNumberPlaceholders = params.orderNumbers.map(() => '?').join(',');
      query = query.replace('PLACEHOLDER_ORDER_NUMBERS', orderNumberPlaceholders);
      queryParams.push(...params.orderNumbers);
      console.log(`FOS_update: Built query for ${params.orderNumbers.length} order numbers`);
    } else {
      // If no order numbers, create a query that won't affect any rows
      query = query.replace('PLACEHOLDER_ORDER_NUMBERS', "'NO_ORDERS'");
      console.log('FOS_update: No order numbers provided, using placeholder');
    }
    return { query, params: queryParams };
  }
  
  // Handle packing_message script specially
  if (scriptKey === 'packing_message') {
    // Add delivery date parameter
    if (params.date) {
      const deliveryDate = formatDate(params.date);
      queryParams.push(deliveryDate);
    }
    
    // Add order numbers filter if provided
    if (params.orderNumbers && params.orderNumbers.length > 0) {
      const orderNumberPlaceholders = params.orderNumbers.map(() => '?').join(',');
      query = query.replace(/ORDER BY/i, `AND so.order_number IN (${orderNumberPlaceholders}) ORDER BY`);
      queryParams.push(...params.orderNumbers);
      console.log(`Packing-Message: Built query for ${params.orderNumbers.length} order numbers`);
    }
    
    return { query, params: queryParams };
  }
  
  // Handle date parameter for other scripts
  if (params.date && baseQuery.includes('sode.delivery_date') && scriptKey !== 'personalized' && scriptKey !== 'gopeople') {
    const deliveryDate = formatDate(params.date);
    
    const whereIndex = query.toLowerCase().indexOf('where');
    if (whereIndex !== -1) {
      const beforeWhere = query.substring(0, whereIndex);
      const fromWhere = query.substring(whereIndex);
      
      const orderByIndex = fromWhere.toLowerCase().indexOf('order by');
      let whereClause, afterOrderBy;
      
      if (orderByIndex !== -1) {
        whereClause = fromWhere.substring(0, orderByIndex);
        afterOrderBy = fromWhere.substring(orderByIndex);
      } else {
        whereClause = fromWhere;
        afterOrderBy = '';
      }
      
      whereClause = whereClause.replace(/sode\.delivery_date\s*=\s*'[^']*'/, 'sode.delivery_date = ?');
      
      query = beforeWhere + whereClause + afterOrderBy;
      queryParams.push(deliveryDate);
    }
  }
  
  // Handle location parameter
  if (params.location && params.location.trim()) {
    if (scriptKey === 'orders') {
      query = query.replace(
        /sfl\.location_name\s+IN\s+\([^)]+\)/g, 
        'sfl.location_name = ?'
      );
    } else {
      const mainWhereMatch = query.match(/(WHERE[\s\S]*?)(ORDER BY|$)/i);
      if (mainWhereMatch) {
        const beforeOrderBy = query.lastIndexOf(mainWhereMatch[2]);
        const insertPoint = beforeOrderBy !== -1 ? beforeOrderBy : query.length;
        
        const beforeWhere = query.substring(0, insertPoint);
        const afterWhere = query.substring(insertPoint);
        
        query = beforeWhere + ' AND sfl.location_name = ? ' + afterWhere;
      }
    }
    queryParams.push(params.location.trim());
  }
  
  // Handle order numbers parameter for personalized and gopeople scripts
  if (params.orderNumbers && params.orderNumbers.length > 0) {
    if (scriptKey === 'personalized') {
      console.log('Adding order numbers filter for personalized:', params.orderNumbers.length, 'orders');
      
      const orderNumberPlaceholders = params.orderNumbers.map(() => '?').join(',');
      
      const mainWhereMatch = query.match(/(WHERE[\s\S]*?)(ORDER BY|$)/i);
      if (mainWhereMatch) {
        const beforeOrderBy = query.lastIndexOf(mainWhereMatch[2]);
        const insertPoint = beforeOrderBy !== -1 ? beforeOrderBy : query.length;
        
        const beforeWhere = query.substring(0, insertPoint);
        const afterWhere = query.substring(insertPoint);
        
        query = beforeWhere + ` AND so.order_number IN (${orderNumberPlaceholders}) ` + afterWhere;
        queryParams.push(...params.orderNumbers);
      }
    } else if (scriptKey === 'gopeople') {
      console.log('Adding order numbers filter for gopeople:', params.orderNumbers.length, 'orders');
      
      const orderNumberPlaceholders = params.orderNumbers.map(() => '?').join(',');
      
      const mainWhereMatch = query.match(/(WHERE[\s\S]*?)(ORDER BY|$)/i);
      if (mainWhereMatch) {
        const beforeOrderBy = query.lastIndexOf(mainWhereMatch[2]);
        const insertPoint = beforeOrderBy !== -1 ? beforeOrderBy : query.length;
        
        const beforeWhere = query.substring(0, insertPoint);
        const afterWhere = query.substring(insertPoint);
        
        query = beforeWhere + ` AND so.order_number IN (${orderNumberPlaceholders}) ` + afterWhere;
        queryParams.push(...params.orderNumbers);
      }
    }
  }
  
  return { query, params: queryParams };
}

// Function to make GoPeople API calls
async function callGoPeopleAPI(orderData) {
  try {
    console.log(`Calling GoPeople API for order: ${orderData.orderNumber}`);
    console.log(`Gopeople API payload:`, orderData.apiPayload);
    const response = await axios.post(
      GOPEOPLE_API_URL,
      orderData.apiPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `bearer ${GOPEOPLE_API_TOKEN}`
        },
        timeout: 5000 // 5 second timeout
      }
    );
    
    return {
      orderNumber: orderData.orderNumber,
      success: response.data.errorCode === 0 && (response.status === 200 || response.status === 201),
      error: `${response.data.errorCode}: ${response.data.message}`
    };
  } catch (error) {
    console.error(`GoPeople API call failed for order ${orderData.orderNumber}:`, error.message);
    
    return {
      orderNumber: orderData.orderNumber,
      success: false,
      error: error.message
    };
  }
}

// Execute GoPeople API calls
async function executeGoPeopleApiCalls(transformedData) {
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  let processedCount = 0;
  
  for (const orderData of transformedData) {
    const apiResult = await callGoPeopleAPI(orderData);
    results.push(apiResult);
    processedCount++;
    
    if (apiResult.success) {
      successCount++;
    } else {
      failureCount++;
    }
    
    // Small delay between API calls to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return {
    results,
    summary: {
      total: processedCount,
      successful: successCount,
      failed: failureCount,
      processed: processedCount
    }
  };
}

// Execute individual script with data transformation and dynamic parameters
async function executeScript(connection, scriptKey, scriptConfig, requestParams = {}) {
  const startTime = Date.now();
  
  try {
    console.log(`Executing script: ${scriptKey} with params:`, requestParams);
    
    // Build dynamic query with parameters
    const { query, params } = buildDynamicQuery(scriptConfig.scriptModule.query, requestParams, scriptKey);

    // Execute SQL query with parameters
    const [rawResults] = await connection.execute(query, params);
    console.log(`Raw results count for ${scriptKey}:`, rawResults.length);
    
    // Apply data transformation if exists
    let transformedData = rawResults;
    let skippedCount = 0;
    let processedOrderNumbers = [];
    let locationSummary = {};
    
    if (scriptConfig.scriptModule.transform && typeof scriptConfig.scriptModule.transform === 'function') {
      // Pass delivery date to transform for gopeople script
      if (scriptKey === 'gopeople') {
        transformedData = scriptConfig.scriptModule.transform(rawResults, requestParams.date);
        skippedCount = rawResults.length - transformedData.length;
        if (skippedCount > 0) {
          console.log(`GoPeople: ${skippedCount} orders skipped due to cutoff times`);
        }
      } else if (scriptKey === 'personalized') {
        // Handle personalized script's dual return
        const personalizedResult = scriptConfig.scriptModule.transform(rawResults);
        transformedData = personalizedResult.transformedData;
        processedOrderNumbers = personalizedResult.processedOrderNumbers;
        console.log(`Personalized: ${processedOrderNumbers.length} orders actually processed`);
      } else if (scriptKey === 'packing_message') {
        // Handle packing_message script's dual return with final batch numbers
        const packingMessageResult = scriptConfig.scriptModule.transform(rawResults, requestParams.finalBatchNumbers);
        transformedData = packingMessageResult.transformedData;
        processedOrderNumbers = packingMessageResult.processedOrderNumbers;
        console.log(`Packing-Message: ${processedOrderNumbers.length} orders actually processed`);
      } else if (scriptKey === 'fos_update') {
        // Handle FOS_update script
        const fosResult = scriptConfig.scriptModule.transform(rawResults, requestParams.orderNumbers);
        transformedData = fosResult.updateResult;
        processedOrderNumbers = fosResult.processedOrderNumbers;
        console.log(`FOS_update: ${processedOrderNumbers.length} orders successfully updated`);
      } else if (scriptKey === 'orders') {
        // Handle orders script with dual return (existing transform + location summary)
        const ordersResult = scriptConfig.scriptModule.transform(rawResults);
        transformedData = ordersResult;
        
        // Generate location summary
        locationSummary = rawResults.reduce((summary, row) => {
          const location = row.location_name;
          if (location) {
            summary[location] = (summary[location] || 0) + 1;
          }
          return summary;
        }, {});
        
        console.log(`Orders: Generated location summary:`, locationSummary);
      } else {
        transformedData = scriptConfig.scriptModule.transform(rawResults);
      }
      console.log(`Transformed data count for ${scriptKey}:`, Array.isArray(transformedData) ? transformedData.length : 1);
    }
    
    const executionTime = Date.now() - startTime;
    
    return {
      scriptKey,
      name: scriptConfig.name,
      success: true,
      recordCount: rawResults.length,
      transformedRecordCount: Array.isArray(transformedData) ? transformedData.length : 1,
      skippedCount: skippedCount,
      executionTime,
      timestamp: new Date().toISOString(),
      appliedParams: {
        date: requestParams.date ? formatDate(requestParams.date) : null,
        location: requestParams.location || null,
        orderNumbers: requestParams.orderNumbers ? requestParams.orderNumbers.length : 0
      },
      data: transformedData,
      processedOrderNumbers: processedOrderNumbers,
      locationSummary: locationSummary
    };
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`Script ${scriptKey} failed:`, error);
    
    return {
      scriptKey,
      name: scriptConfig.name,
      success: false,
      error: error.message,
      executionTime,
      timestamp: new Date().toISOString(),
      appliedParams: requestParams,
      data: null,
      processedOrderNumbers: [],
      locationSummary: {}
    };
  }
}

// CORS middleware
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }
  
  next();
});

// Main route handler
app.get('/', async (req, res) => {
  const overallStartTime = Date.now();
  let connection;
  
  try {
    // Extract query parameters
    const requestParams = {
      date: req.query.date || null,
      location: req.query.location || null,
      dev_mode: parseDevMode(req.query.dev_mode)
    };
    
    console.log('Request parameters:', requestParams);
    
    // Parse dev_mode flags
    const executeGoPeopleApiCalls_flag = requestParams.dev_mode[0] === '1';
    const executeFosUpdate_flag = requestParams.dev_mode[1] === '1';
    
    console.log(`Dev mode flags - GoPeople API: ${executeGoPeopleApiCalls_flag}, FOS Update: ${executeFosUpdate_flag}`);
    
    // Format delivery date for batch management
    const deliveryDate = formatDate(requestParams.date);
    console.log(`Batch Management: Using delivery date: ${deliveryDate}`);
    
    // Step 0: Get current batch numbers from Firestore
    console.log('Batch Management: Fetching current batch numbers...');
    const currentBatchNumbers = await getBatchNumbers(deliveryDate);
    
    console.log('Starting database connection...');
    connection = await mysql.createConnection(dbConfig);

    // Step 1: Execute orders script first
    console.log('Executing orders script...');
    const ordersResult = await executeScript(connection, 'orders', SCRIPTS_CONFIG.orders, requestParams);
    
    const results = {};
    const executionDetails = {};
    let successCount = 0;
    let failureCount = 0;
    
    // Initialize order tracking array
    let orderTrackingArray = [];
    let finalBatchNumbers = { ...currentBatchNumbers };
    let folderPreCreationResults = null; // Track folder pre-creation results
    
    // Process orders result
    results['orders'] = ordersResult.data;
    const { data: ordersData, processedOrderNumbers: ordersProcessedOrderNumbers, locationSummary, scriptKey: ordersScriptKey, ...ordersExecutionInfo } = ordersResult;
    executionDetails['orders'] = ordersExecutionInfo;
    
    if (ordersResult.success) {
      successCount++;
      
      // Step 1.5: Update batch numbers based on location summary
      console.log('Batch Management: Updating batch numbers based on order counts...');
      finalBatchNumbers = await updateBatchNumbers(deliveryDate, locationSummary, currentBatchNumbers);
      
      // Initialize tracking array with order numbers, locations, and batch numbers
      if (ordersResult.data && Array.isArray(ordersResult.data) && ordersResult.data.length > 0) {
        orderTrackingArray = ordersResult.data.map(orderData => ({
          order_number: orderData.order_number,
          location: orderData.location,
          batch: finalBatchNumbers[orderData.location],
          gopeople_status: false,
          gopeople_error: null,
          personalized_status: false,
          packing_slip_status: false, // NEW FIELD
          message_cards_status: false, // NEW FIELD
          updateProcessingStatus: false
        }));
        console.log(`Initialized tracking array with ${orderTrackingArray.length} orders`);
      }
    } else {
      failureCount++;
    }
    
    // Step 2: Execute gopeople script if orders script was successful and returned results
    let gopeopleApiResults = null;
    
    if (ordersResult.success && ordersResult.data && Array.isArray(ordersResult.data) && ordersResult.data.length > 0) {
      const orderNumbers = ordersResult.data.map(orderData => orderData.order_number);
      console.log(`Orders script returned ${orderNumbers.length} order numbers.`);
      
      // Check if gopeople should be executed based on dev_mode
      if (executeGoPeopleApiCalls_flag) {
        // Execute GoPeople script
        const extendedParams = {
          ...requestParams,
          orderNumbers: orderNumbers
        };
        
        console.log('Executing gopeople script...');
        const gopeopleResult = await executeScript(connection, 'gopeople', SCRIPTS_CONFIG.gopeople, extendedParams);
        
        if (gopeopleResult.success) {
          // Check if there are any orders to process (not all skipped)
          if (gopeopleResult.data && gopeopleResult.data.length > 0) {
            // Make API calls for each transformed order
            console.log(`Making GoPeople API calls for ${gopeopleResult.data.length} orders...`);
            gopeopleApiResults = await executeGoPeopleApiCalls(gopeopleResult.data);
            
            // Add skipped count to the summary
            gopeopleApiResults.summary.skipped = gopeopleResult.skippedCount;
            gopeopleApiResults.summary.totalOrders = gopeopleResult.recordCount;
            
            results['gopeople'] = gopeopleApiResults;
            
            // Update tracking array with gopeople results
            gopeopleApiResults.results.forEach(apiResult => {
              const trackingEntry = orderTrackingArray.find(entry => entry.order_number === apiResult.orderNumber);
              if (trackingEntry) {
                trackingEntry.gopeople_status = apiResult.success;
                trackingEntry.gopeople_error = apiResult.success ? null : apiResult.error;
              }
            });
            
            const { data: gopeopleData, processedOrderNumbers: gopeopleProcessedOrderNumbers, scriptKey: gopeopleScriptKey, ...gopeopleExecutionInfo } = gopeopleResult;
            executionDetails['gopeople'] = {
              ...gopeopleExecutionInfo,
              apiCallsSummary: gopeopleApiResults.summary,
              devModeSkipped: false
            };
            
            successCount++;
          } else if (gopeopleResult.skippedCount > 0) {
            // All orders were skipped due to cutoff
            console.log(`All ${gopeopleResult.skippedCount} orders were past cutoff time. No API calls made.`);
            
            results['gopeople'] = {
              results: [],
              summary: {
                total: 0,
                successful: 0,
                failed: 0,
                processed: 0,
                skipped: gopeopleResult.skippedCount,
                totalOrders: gopeopleResult.recordCount,
                message: 'All orders past cutoff time'
              }
            };
            
            const { data: gopeopleData, processedOrderNumbers: gopeopleProcessedOrderNumbers, scriptKey: gopeopleScriptKey, ...gopeopleExecutionInfo } = gopeopleResult;
            executionDetails['gopeople'] = {
              ...gopeopleExecutionInfo,
              apiCallsSummary: {
                total: 0,
                successful: 0,
                failed: 0,
                skipped: gopeopleResult.skippedCount,
                message: 'All orders past cutoff time'
              }
            };
            
            // All orders failed gopeople due to cutoff
            orderTrackingArray.forEach(entry => {
              entry.gopeople_error = 'Order past cutoff time';
            });
            
            successCount++;
          } else {
            // No data returned at all
            results['gopeople'] = null;
            
            const { data: gopeopleData, processedOrderNumbers: gopeopleProcessedOrderNumbers, scriptKey: gopeopleScriptKey, ...gopeopleExecutionInfo } = gopeopleResult;
            executionDetails['gopeople'] = gopeopleExecutionInfo;
            
            failureCount++;
          }
        } else {
          // Script failed
          results['gopeople'] = null;
          
          const { data: gopeopleData, processedOrderNumbers: gopeopleProcessedOrderNumbers, scriptKey: gopeopleScriptKey, ...gopeopleExecutionInfo } = gopeopleResult;
          executionDetails['gopeople'] = gopeopleExecutionInfo;
          
          // Set error for all orders in tracking array
          orderTrackingArray.forEach(entry => {
            entry.gopeople_error = 'GoPeople script failed';
          });
          
          failureCount++;
        }
      } else {
        // Dev mode: Skip GoPeople entirely
        console.log('Dev mode: Skipping GoPeople script execution entirely');
        
        results['gopeople'] = null;
        executionDetails['gopeople'] = {
          scriptKey: 'gopeople',
          name: 'GoPeople Logistics API',
          success: false,
          skipped: true,
          reason: 'Skipped due to dev_mode flag (executeGoPeopleApiCalls_flag = false)',
          devModeSkipped: true,
          executionTime: 0,
          timestamp: new Date().toISOString(),
          appliedParams: requestParams
        };
        
        // Set error for all orders in tracking array since gopeople was skipped
        orderTrackingArray.forEach(entry => {
          entry.gopeople_error = 'GoPeople skipped due to dev_mode';
        });
        
        failureCount++;
      }
    } else {
      console.log('Orders script returned no results or failed. Skipping gopeople script.');
      
      results['gopeople'] = null;
      executionDetails['gopeople'] = {
        scriptKey: 'gopeople',
        name: 'GoPeople Logistics API',
        success: false,
        skipped: true,
        reason: 'No orders found to process',
        executionTime: 0,
        timestamp: new Date().toISOString(),
        appliedParams: requestParams
      };
      
      // No batch number updates since no orders found
      finalBatchNumbers = { ...currentBatchNumbers };
      console.log('Batch Management: No batch updates - no orders found');
      
      failureCount++;
    }
    
    // Step 2.5: Update batch numbers based on successful gopeople orders
    if (orderTrackingArray.length > 0) {
      // Count successful gopeople orders by location
      const successfulGopeopleLocationCounts = orderTrackingArray.reduce((counts, entry) => {
        if (entry.gopeople_status === true && entry.location) {
          counts[entry.location] = (counts[entry.location] || 0) + 1;
        }
        return counts;
      }, {});
      
      console.log('Batch Management: Updating batch numbers based on successful gopeople orders:', successfulGopeopleLocationCounts);
      finalBatchNumbers = await updateBatchNumbers(deliveryDate, successfulGopeopleLocationCounts, currentBatchNumbers);
      
      // Now update tracking array with final batch numbers
      orderTrackingArray.forEach(entry => {
        if (entry.location && finalBatchNumbers[entry.location] !== undefined) {
          entry.batch = finalBatchNumbers[entry.location];
        }
      });
      
      console.log(`Updated tracking array with final batch numbers for ${orderTrackingArray.length} orders`);
    } else {
      // No orders to process
      finalBatchNumbers = { ...currentBatchNumbers };
      console.log('Batch Management: No batch updates - no orders to process');
    }
    
    // NEW STEP 2.75: Pre-create folder structure for successful GoPeople orders
    if (orderTrackingArray.length > 0) {
      // Get successful GoPeople orders
      const successfulGopeopleOrders = orderTrackingArray.filter(entry => entry.gopeople_status === true);
      
      if (successfulGopeopleOrders.length > 0) {
        console.log('=== Starting Google Drive folder pre-creation ===');
        console.log(`Pre-creating folders for ${successfulGopeopleOrders.length} successful GoPeople orders`);
        
        try {
          const gdriveService = new GoogleDriveService();
          
          // Pre-create folder structure for all successful orders
          folderPreCreationResults = await gdriveService.preCreateFolderStructure(
            successfulGopeopleOrders,
            deliveryDate,
            finalBatchNumbers
          );
          
          console.log('Folder pre-creation completed:', folderPreCreationResults.summary);
          
          // Log any failures for visibility
          if (folderPreCreationResults.failedFolders.length > 0) {
            console.error('Failed folder creations:', folderPreCreationResults.failedFolders);
          }
        } catch (error) {
          console.error('Error during folder pre-creation:', error.message);
          // Continue with the process even if folder pre-creation fails
          folderPreCreationResults = {
            success: false,
            error: error.message,
            summary: {
              totalLocations: 0,
              successfulCreations: 0,
              failedCreations: 0
            }
          };
        }
        
        console.log('=== Folder pre-creation step completed ===');
      } else {
        console.log('No successful GoPeople orders, skipping folder pre-creation');
      }
    }
    
    // Step 3: Execute personalized script only for orders where gopeople_status = true
    if (orderTrackingArray.length > 0) {
      // Filter orders where gopeople_status = true 
      const successfulGopeopleOrders = orderTrackingArray
        .filter(entry => entry.gopeople_status === true)
        .map(entry => entry.order_number);
      
      if (successfulGopeopleOrders.length > 0) {
        const extendedParams = {
          ...requestParams,
          orderNumbers: successfulGopeopleOrders
        };
        
        console.log(`Executing personalized script with ${successfulGopeopleOrders.length} orders that passed gopeople...`);
        const personalizedResult = await executeScript(connection, 'personalized', SCRIPTS_CONFIG.personalized, extendedParams);
        
        if (personalizedResult.success) {
          // Add batch information to personalized data
          let personalizedDataWithBatch = personalizedResult.data;
          if (Array.isArray(personalizedDataWithBatch)) {
            personalizedDataWithBatch = personalizedDataWithBatch.map(locationEntry => {
              if (typeof locationEntry === 'string') {
                // Parse JSON string
                const parsed = JSON.parse(locationEntry);
                // Add batch number based on location
                if (parsed.location && finalBatchNumbers[parsed.location] !== undefined) {
                  parsed.batch = finalBatchNumbers[parsed.location];
                }
                return JSON.stringify(parsed);
              } else if (typeof locationEntry === 'object' && locationEntry.location) {
                // Add batch number to object
                if (finalBatchNumbers[locationEntry.location] !== undefined) {
                  locationEntry.batch = finalBatchNumbers[locationEntry.location];
                }
                return JSON.stringify(locationEntry);
              }
              return JSON.stringify(locationEntry);
            });
          }
          
          // Store personalized data temporarily (will be combined with packing/message data later)
          const tempPersonalizedData = personalizedDataWithBatch;
          
          const { data: personalizedData, processedOrderNumbers: personalizedProcessedOrderNumbers, scriptKey: personalizedScriptKey, ...personalizedExecutionInfo } = personalizedResult;
          executionDetails['personalized'] = personalizedExecutionInfo;
          
          // Update tracking array - only set personalized_status = true for orders that were actually processed
          if (personalizedProcessedOrderNumbers && personalizedProcessedOrderNumbers.length > 0) {
            personalizedProcessedOrderNumbers.forEach(orderNumber => {
              const trackingEntry = orderTrackingArray.find(entry => entry.order_number === orderNumber);
              if (trackingEntry) {
                trackingEntry.personalized_status = true;
              }
            });
            console.log(`Updated personalized_status for ${personalizedProcessedOrderNumbers.length} orders`);
          }
          
          successCount++;
          
          // NEW STEP 3.6: Execute packing slip and message cards processing
          console.log(`Executing packing-message script with ${successfulGopeopleOrders.length} orders...`);
          const packingMessageParams = {
            ...requestParams,
            orderNumbers: successfulGopeopleOrders,
            finalBatchNumbers: finalBatchNumbers
          };
          
          const packingMessageResult = await executeScript(connection, 'packing_message', SCRIPTS_CONFIG.packing_message, packingMessageParams);
          
          if (packingMessageResult.success) {
            // Add batch information to packing-message data
            let packingMessageDataWithBatch = packingMessageResult.data;
            if (Array.isArray(packingMessageDataWithBatch)) {
              packingMessageDataWithBatch = packingMessageDataWithBatch.map(locationEntry => {
                if (typeof locationEntry === 'object' && locationEntry.location) {
                  // Add batch number and shop_id to object
                  if (finalBatchNumbers[locationEntry.location] !== undefined) {
                    locationEntry.batch = finalBatchNumbers[locationEntry.location];
                    locationEntry.shop_id = 10; // Add shop_id consistently
                  }
                }
                return locationEntry;
              });
            }
            
            // Combine personalized and packing-message data
            const combinedData = combinePersonalizedAndPackingMessage(tempPersonalizedData, packingMessageDataWithBatch);
            
            // Set the combined result in the renamed field
            results['personalized_packingslip_notes'] = combinedData;
            
            const { data: packingMessageData, processedOrderNumbers: packingMessageProcessedOrderNumbers, scriptKey: packingMessageScriptKey, ...packingMessageExecutionInfo } = packingMessageResult;
            executionDetails['packing_message'] = packingMessageExecutionInfo;
            
            // Update tracking array for both packing slip and message cards status
            if (packingMessageProcessedOrderNumbers && packingMessageProcessedOrderNumbers.length > 0) {
              packingMessageProcessedOrderNumbers.forEach(orderNumber => {
                const trackingEntry = orderTrackingArray.find(entry => entry.order_number === orderNumber);
                if (trackingEntry) {
                  // Check what type of data was processed for this order
                  const hasPackingSlip = packingMessageDataWithBatch.some(locationData => 
                    locationData.packing_slips_data && 
                    locationData.packing_slips_data.some(order => order.order_number === orderNumber)
                  );
                  const hasMessageCard = packingMessageDataWithBatch.some(locationData => 
                    locationData.message_cards_data && 
                    locationData.message_cards_data.some(message => message.order_number === orderNumber)
                  );
                  
                  trackingEntry.packing_slip_status = hasPackingSlip;
                  trackingEntry.message_cards_status = hasMessageCard;
                }
              });
              console.log(`Updated packing slip and message cards status for ${packingMessageProcessedOrderNumbers.length} orders`);
            }
            
            successCount++;
          } else {
            // Packing-message failed, but still use personalized data
            results['personalized_packingslip_notes'] = tempPersonalizedData;
            
            const { data: packingMessageData, processedOrderNumbers: packingMessageProcessedOrderNumbers, scriptKey: packingMessageScriptKey, ...packingMessageExecutionInfo } = packingMessageResult;
            executionDetails['packing_message'] = packingMessageExecutionInfo;
            
            failureCount++;
          }
        } else {
          results['personalized_packingslip_notes'] = null;
          
          const { data: personalizedData, processedOrderNumbers: personalizedProcessedOrderNumbers, scriptKey: personalizedScriptKey, ...personalizedExecutionInfo } = personalizedResult;
          executionDetails['personalized'] = personalizedExecutionInfo;
          
          // Also skip packing-message since personalized failed
          executionDetails['packing_message'] = {
            scriptKey: 'packing_message',
            name: 'Packing Slip and Message Cards',
            success: false,
            skipped: true,
            reason: 'Personalized script failed',
            executionTime: 0,
            timestamp: new Date().toISOString(),
            appliedParams: requestParams
          };
          
          failureCount += 2; // Both personalized and packing-message failed
        }
      } else {
        console.log('No orders passed gopeople validation. Skipping personalized and packing-message scripts.');
        
        results['personalized_packingslip_notes'] = null;
        executionDetails['personalized'] = {
          scriptKey: 'personalized',
          name: 'Personalized Products Report',
          success: false,
          skipped: true,
          reason: 'No orders passed gopeople validation',
          executionTime: 0,
          timestamp: new Date().toISOString(),
          appliedParams: requestParams
        };
        
        executionDetails['packing_message'] = {
          scriptKey: 'packing_message',
          name: 'Packing Slip and Message Cards',
          success: false,
          skipped: true,
          reason: 'No orders passed gopeople validation',
          executionTime: 0,
          timestamp: new Date().toISOString(),
          appliedParams: requestParams
        };
        
        failureCount += 2;
      }
    } else {
      console.log('No orders found. Skipping personalized and packing-message scripts.');
      
      results['personalized_packingslip_notes'] = null;
      executionDetails['personalized'] = {
        scriptKey: 'personalized',
        name: 'Personalized Products Report',
        success: false,
        skipped: true,
        reason: 'No orders found to process',
        executionTime: 0,
        timestamp: new Date().toISOString(),
        appliedParams: requestParams
      };
      
      executionDetails['packing_message'] = {
        scriptKey: 'packing_message',
        name: 'Packing Slip and Message Cards',
        success: false,
        skipped: true,
        reason: 'No orders found to process',
        executionTime: 0,
        timestamp: new Date().toISOString(),
        appliedParams: requestParams
      };
      
      failureCount += 2;
    }

    // Step 3.5: Process polaroid images to Google Drive (folders already pre-created)
    let polaroidProcessingResults = null;

    if (results['personalized_packingslip_notes'] && Array.isArray(results['personalized_packingslip_notes'])) {
      // Extract polaroid data from personalized results
      const polaroidData = results['personalized_packingslip_notes']
        .map(item => {
          try {
            const parsed = typeof item === 'string' ? JSON.parse(item) : item;
            return parsed.polaroid_photo_data ? parsed : null;
          } catch (error) {
            console.error('Error parsing personalized item:', error);
            return null;
          }
        })
        .filter(item => item && item.polaroid_photo_data);

      if (polaroidData.length > 0) {
        console.log(`Processing ${polaroidData.length} locations with polaroid data...`);
        console.log('Note: Folders should already exist from pre-creation step');
        
        try {
          const gdriveService = new GoogleDriveService();
          
          // Use the delivery date and final batch numbers from the main process
          polaroidProcessingResults = await gdriveService.processPolaroidImages(
            polaroidData, 
            deliveryDate, 
            finalBatchNumbers
          );
          
          console.log('Polaroid processing completed:', polaroidProcessingResults.summary);
        } catch (error) {
          console.error('Error processing polaroid images:', error.message);
          polaroidProcessingResults = {
            success: false,
            error: error.message,
            summary: {
              totalImages: 0,
              successfulUploads: 0,
              failedUploads: 0,
              locationsProcessed: 0
            }
          };
        }
      } else {
        console.log('No polaroid data found in personalized results');
      }
    } else {
      console.log('No personalized results available for polaroid processing');
    }

    
    // Step 4: Execute FOS_update script for orders that went to personalized script
    if (orderTrackingArray.length > 0) {
      // Get orders that went to personalized script (same as successfulGopeopleOrders)
      const ordersForPersonalized = orderTrackingArray
        .filter(entry => entry.gopeople_status === true)
        .map(entry => entry.order_number);
      
      if (ordersForPersonalized.length > 0 && executeFosUpdate_flag) {
        const fosExtendedParams = {
          ...requestParams,
          orderNumbers: ordersForPersonalized
        };
        
        console.log(`Executing FOS_update script with ${ordersForPersonalized.length} orders that went to personalized...`);
        const fosUpdateResult = await executeScript(connection, 'fos_update', SCRIPTS_CONFIG.fos_update, fosExtendedParams);
        
        if (fosUpdateResult.success) {
          results['fos_update'] = fosUpdateResult.data;
          
          const { data: fosData, processedOrderNumbers: fosProcessedOrderNumbers, scriptKey: fosScriptKey, ...fosExecutionInfo } = fosUpdateResult;
          executionDetails['fos_update'] = fosExecutionInfo;
          
          // Update tracking array - set updateProcessingStatus = true for orders that were successfully updated
          if (fosProcessedOrderNumbers && fosProcessedOrderNumbers.length > 0) {
            fosProcessedOrderNumbers.forEach(orderNumber => {
              const trackingEntry = orderTrackingArray.find(entry => entry.order_number === orderNumber);
              if (trackingEntry) {
                trackingEntry.updateProcessingStatus = true;
              }
            });
            console.log(`Updated updateProcessingStatus for ${fosProcessedOrderNumbers.length} orders`);
          }
          
          successCount++;
        } else {
          results['fos_update'] = null;
          
          const { data: fosData, processedOrderNumbers: fosProcessedOrderNumbers, scriptKey: fosScriptKey, ...fosExecutionInfo } = fosUpdateResult;
          executionDetails['fos_update'] = fosExecutionInfo;
          
          failureCount++;
        }
      } else if (!executeFosUpdate_flag) {
        console.log('Dev mode: Skipping FOS_update script execution');
        
        results['fos_update'] = null;
        executionDetails['fos_update'] = {
          scriptKey: 'fos_update',
          name: 'FOS Update Script',
          success: false,
          skipped: true,
          reason: 'Skipped due to dev_mode flag',
          devModeSkipped: true,
          executionTime: 0,
          timestamp: new Date().toISOString(),
          appliedParams: requestParams
        };
        
        failureCount++;
      } else {
        console.log('No orders available for FOS_update script.');
        
        results['fos_update'] = null;
        executionDetails['fos_update'] = {
          scriptKey: 'fos_update',
          name: 'FOS Update Script',
          success: false,
          skipped: true,
          reason: 'No orders available for processing',
          executionTime: 0,
          timestamp: new Date().toISOString(),
          appliedParams: requestParams
        };
        
        failureCount++;
      }
    } else {
      console.log('No orders found. Skipping FOS_update script.');
      
      results['fos_update'] = null;
      executionDetails['fos_update'] = {
        scriptKey: 'fos_update',
        name: 'FOS Update Script',
        success: false,
        skipped: true,
        reason: 'No orders found to process',
        executionTime: 0,
        timestamp: new Date().toISOString(),
        appliedParams: requestParams
      };
      
      failureCount++;
    }
    
    const overallExecutionTime = Date.now() - overallStartTime;
    
    console.log(`All scripts completed. Success: ${successCount}, Failed/Skipped: ${failureCount}`);
    console.log(`Order tracking array final state:`, orderTrackingArray.length, 'orders');
    console.log('Final batch numbers used:', finalBatchNumbers);
    
    // Check if request is from Zapier and apply formatting
    const isZapierRequest = req.query.source === 'zapier';
    if (isZapierRequest) {
      console.log('Applying Zapier formatting...');
      
      // Convert orders data to the expected format (array of order_number strings)
      if (results.orders && Array.isArray(results.orders)) {
        const orderNumbersOnly = results.orders.map(orderData => orderData.order_number);
        results.orders = JSON.stringify(orderNumbersOnly);
      }
      
      // Stringify gopeople results
      if (results.gopeople) {
        results.gopeople = JSON.stringify(results.gopeople);
      }
      
      // Format personalized_packingslip_notes data - already has batch info added above
      if (results.personalized_packingslip_notes && Array.isArray(results.personalized_packingslip_notes)) {
        // Results are already formatted as JSON strings with batch info
      }
      
      // Stringify fos_update results
      if (results.fos_update) {
        results.fos_update = JSON.stringify(results.fos_update);
      }
    }
    
    // Return structured response
    res.status(200).json({
      success: successCount > 0,
      message: `Executed ${successCount + failureCount} scripts`,
      totalScripts: Object.keys(SCRIPTS_CONFIG).length,
      successCount,
      failureCount,
      overallExecutionTime,
      timestamp: new Date().toISOString(),
      requestParams: {
        ...requestParams,
        orderNumbersFound: orderTrackingArray.length
      },
      batchInfo: {
        deliveryDate: deliveryDate,
        initialBatchNumbers: currentBatchNumbers,
        finalBatchNumbers: finalBatchNumbers,
        locationOrderCounts: locationSummary || {}
      },
      executionDetails,
      data: results,
      folderPreCreation: folderPreCreationResults,
      polaroidProcessing: polaroidProcessingResults,
      overall: orderTrackingArray // Updated with packing_slip_status and message_cards_status fields
    });

  } catch (error) {
    console.error('Overall function error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
});

// Helper function to combine personalized and packing-message data
function combinePersonalizedAndPackingMessage(personalizedData, packingMessageData) {
  console.log('Combining personalized and packing-message data...');
  
  if (!personalizedData && !packingMessageData) {
    return [];
  }
  
  // Start with personalized data (already properly formatted as separate entries)
  let combinedResult = [];
  
  if (personalizedData) {
    combinedResult = [...personalizedData]; // Keep existing personalized entries as-is
  }
  
  // Add packing-message entries (now separate entries from packing-message.js changes)
  if (packingMessageData && packingMessageData.length > 0) {
    packingMessageData.forEach(item => {
      combinedResult.push(JSON.stringify(item)); // Convert to JSON string for consistency
    });
  }
  
  console.log(`Combined ${personalizedData ? personalizedData.length : 0} personalized items with ${packingMessageData ? packingMessageData.length : 0} packing-message items into ${combinedResult.length} total items`);
  
  return combinedResult;
}

// Handle unsupported methods
app.all('*', (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['GET', 'OPTIONS']
    });
  } else {
    res.status(404).json({
      error: 'Not found'
    });
  }
});

// Start the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});