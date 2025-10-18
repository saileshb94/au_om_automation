const { google } = require('googleapis');
const { GOOGLE_SHEETS_CONFIG } = require('../config');

/**
 * GoogleSheetsService
 *
 * Service for writing order tracking data to Google Sheets.
 * Uses the same Google service account credentials as Google Drive integration.
 */
class GoogleSheetsService {
  constructor() {
    this.config = GOOGLE_SHEETS_CONFIG;
    this.sheets = null;
    this.initialized = false;
  }

  /**
   * Initialize Google Sheets API client
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Parse credentials from environment variable
      const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS_JSON);

      // Create auth client
      const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      // Create sheets client
      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;

      console.log('Google Sheets API client initialized successfully');
    } catch (error) {
      console.error('Error initializing Google Sheets API:', error.message);
      throw new Error(`Failed to initialize Google Sheets API: ${error.message}`);
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration() {
    const issues = [];

    if (!this.config.spreadsheetId) {
      issues.push('Missing spreadsheet ID in configuration');
    }

    if (!this.config.sheetName) {
      issues.push('Missing sheet name in configuration');
    }

    if (!this.config.columns || this.config.columns.length === 0) {
      issues.push('Missing column configuration');
    }

    if (!process.env.GOOGLE_DRIVE_CREDENTIALS_JSON) {
      issues.push('Missing Google credentials in environment variables');
    }

    return {
      valid: issues.length === 0,
      issues: issues
    };
  }

  /**
   * Transform order tracking array into sheet rows
   * @param {Array} orderTrackingArray - Array of order tracking objects
   * @returns {Array} Array of row values matching column order
   */
  transformOrdersToRows(orderTrackingArray) {
    const timestamp = this.convertToMelbourneDateTime(new Date().toISOString());

    return orderTrackingArray.map(order => {
      return this.config.columns.map(column => {
        if (column === 'timestamp') {
          return timestamp;
        }

        // Handle null/undefined values
        const value = order[column];
        if (value === null || value === undefined) {
          return '';
        }

        // Convert boolean to string for better readability
        if (typeof value === 'boolean') {
          return value ? 'TRUE' : 'FALSE';
        }

        return value.toString();
      });
    });
  }

  /**
   * Append rows to Google Sheet
   * @param {Array} orderTrackingArray - Array of order tracking objects
   * @returns {Object} Result of the operation
   */
  async appendOrdersToSheet(orderTrackingArray) {
    const startTime = Date.now();

    try {
      // Validate configuration
      const validation = this.validateConfiguration();
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.issues.join(', ')}`);
      }

      // Initialize if not already done
      await this.initialize();

      // Validate input
      if (!orderTrackingArray || !Array.isArray(orderTrackingArray) || orderTrackingArray.length === 0) {
        return {
          success: true,
          message: 'No orders to write to Google Sheets',
          rowsWritten: 0,
          executionTime: Date.now() - startTime
        };
      }

      console.log(`\n📊 === GOOGLE SHEETS WRITE OPERATION ===`);
      console.log(`Spreadsheet ID: ${this.config.spreadsheetId}`);
      console.log(`Sheet Name: ${this.config.sheetName}`);
      console.log(`Orders to write: ${orderTrackingArray.length}`);

      // Transform orders to row format
      const rows = this.transformOrdersToRows(orderTrackingArray);

      // Prepare the request
      const range = `${this.config.sheetName}!A:A`; // Start from column A
      const valueInputOption = 'USER_ENTERED';

      // Append data to sheet
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: range,
        valueInputOption: valueInputOption,
        insertDataOption: 'INSERT_ROWS', // Insert new rows instead of overwriting
        requestBody: {
          values: rows
        }
      });

      const updatedRange = response.data.updates.updatedRange;
      const updatedRows = response.data.updates.updatedRows;

      console.log(`✅ Successfully wrote ${updatedRows} rows to ${updatedRange}`);
      console.log(`=== END GOOGLE SHEETS WRITE OPERATION ===\n`);

      return {
        success: true,
        message: `Successfully wrote ${updatedRows} orders to Google Sheets`,
        rowsWritten: updatedRows,
        updatedRange: updatedRange,
        executionTime: Date.now() - startTime,
        spreadsheetId: this.config.spreadsheetId,
        sheetName: this.config.sheetName
      };

    } catch (error) {
      console.error('Error writing to Google Sheets:', error.message);

      return {
        success: false,
        error: error.message,
        rowsWritten: 0,
        executionTime: Date.now() - startTime,
        spreadsheetId: this.config.spreadsheetId,
        sheetName: this.config.sheetName
      };
    }
  }

  /**
   * Get column headers (for initial sheet setup or verification)
   * @returns {Array} Column headers
   */
  getColumnHeaders() {
    return this.config.columns;
  }

  /**
   * Check if sheet exists and create it if needed (optional helper method)
   * @param {string} spreadsheetId - The spreadsheet ID
   * @param {string} sheetName - The sheet name to check/create
   */
  async ensureSheetExists(spreadsheetId, sheetName) {
    try {
      await this.initialize();

      // Get spreadsheet metadata
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });

      // Check if sheet exists
      const sheetExists = spreadsheet.data.sheets.some(
        sheet => sheet.properties.title === sheetName
      );

      if (!sheetExists) {
        console.log(`Sheet "${sheetName}" not found. Creating new sheet...`);

        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }]
          }
        });

        console.log(`✅ Created new sheet: ${sheetName}`);
      }

      return { exists: true, created: !sheetExists };

    } catch (error) {
      console.error('Error checking/creating sheet:', error.message);
      throw error;
    }
  }

  /**
   * Extract time from pickUpDate string without timezone conversion
   * Simply extracts the HH:MM portion from the pickUpDate string
   * @param {string} pickUpDateString - Format: "YYYY-MM-DD HH:MM:SS+ZZZZ"
   * @returns {string} Time in HH:MM format (as-is from the string)
   */
  extractTimeInMelbourneTimezone(pickUpDateString) {
    if (!pickUpDateString) {
      return '';
    }

    try {
      // Parse the pickUpDate string (format: "2025-10-17 14:30:00+1100")
      // Extract the time portion directly without timezone conversion
      const match = pickUpDateString.match(/\d{4}-\d{2}-\d{2}\s+(\d{2}):(\d{2}):\d{2}/);

      if (match) {
        const hours = match[1];
        const minutes = match[2];
        return `${hours}:${minutes}`;
      }

      return '';
    } catch (error) {
      console.error(`Error parsing pickUpDate: ${pickUpDateString}`, error);
      return '';
    }
  }

  /**
   * Convert timestamp from UTC to Melbourne datetime format
   * @param {string} isoTimestamp - ISO timestamp string
   * @returns {string} Formatted Melbourne datetime
   */
  convertToMelbourneDateTime(isoTimestamp) {
    try {
      const date = new Date(isoTimestamp);
      return date.toLocaleString('en-AU', {
        timeZone: 'Australia/Melbourne',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error(`Error converting timestamp: ${isoTimestamp}`, error);
      return isoTimestamp;
    }
  }

  /**
   * Generate batch details from order tracking array
   * Groups orders by (store, delivery_date, location, is_same_day, batch)
   * @param {Array} orderTrackingArray - Array of order tracking objects
   * @returns {Array} Array of batch detail objects
   */
  generateBatchDetails(orderTrackingArray) {
    if (!orderTrackingArray || !Array.isArray(orderTrackingArray) || orderTrackingArray.length === 0) {
      return [];
    }

    const timestamp = new Date().toISOString();
    const batchMap = {};

    // Group orders by batch key
    orderTrackingArray.forEach(order => {
      const batchKey = `${order.store}|${order.delivery_date}|${order.location}|${order.is_same_day}|${order.batch}`;

      if (!batchMap[batchKey]) {
        batchMap[batchKey] = {
          store: order.store,
          delivery_date: order.delivery_date,
          city: order.location,
          same_day: order.is_same_day,
          batch: order.batch,
          successOrders: [],
          failedOrders: [],
          gpPickupDates: [] // Store GP pickup dates for this batch
        };
      }

      // Check if order succeeded (either gopeople_status OR auspost_status is true)
      const isSuccess = order.gopeople_status === true || order.auspost_status === true;

      if (isSuccess) {
        batchMap[batchKey].successOrders.push(order.order_number);

        // Collect GP pickup dates for successful GoPeople orders
        if (order.gopeople_status === true && order.gp_pickupdate) {
          batchMap[batchKey].gpPickupDates.push(order.gp_pickupdate);
        }
      } else {
        // Failed: both gopeople_status AND auspost_status are false
        batchMap[batchKey].failedOrders.push(order.order_number);
      }
    });

    // Transform map to array of batch details
    const batchDetails = Object.values(batchMap).map(batch => {
      // Extract unique GP timeframes (convert to Melbourne HH:MM format)
      let gpTimeframe = '';
      if (batch.gpPickupDates.length > 0) {
        const uniqueTimes = [...new Set(batch.gpPickupDates.map(pickupDate =>
          this.extractTimeInMelbourneTimezone(pickupDate)
        ))].filter(time => time !== '');
        gpTimeframe = uniqueTimes.join(', ');
      }

      return {
        store: batch.store,
        delivery_date: batch.delivery_date,
        city: batch.city,
        same_day: batch.same_day,
        batch: batch.batch,
        count_success_orders: batch.successOrders.length,
        orders: batch.successOrders.join(', '),
        failed_orders: batch.failedOrders.join(', '),
        gp_timeframe: gpTimeframe,
        timestamp: this.convertToMelbourneDateTime(timestamp)
      };
    });

    console.log(`Generated ${batchDetails.length} batch detail entries from ${orderTrackingArray.length} orders`);
    return batchDetails;
  }

  /**
   * Transform batch details array into sheet rows
   * @param {Array} batchDetailsArray - Array of batch detail objects
   * @returns {Array} Array of row values matching batchesColumns order
   */
  transformBatchDetailsToRows(batchDetailsArray) {
    return batchDetailsArray.map(batchDetail => {
      return this.config.batchesColumns.map(column => {
        const value = batchDetail[column];

        // Handle null/undefined values
        if (value === null || value === undefined) {
          return '';
        }

        // Convert to string
        return value.toString();
      });
    });
  }

  /**
   * Append batch details to Batches sheet
   * @param {Array} batchDetailsArray - Array of batch detail objects
   * @returns {Object} Result of the operation
   */
  async appendBatchDetailsToSheet(batchDetailsArray) {
    const startTime = Date.now();

    try {
      // Validate configuration
      const validation = this.validateConfiguration();
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.issues.join(', ')}`);
      }

      // Initialize if not already done
      await this.initialize();

      // Validate input
      if (!batchDetailsArray || !Array.isArray(batchDetailsArray) || batchDetailsArray.length === 0) {
        return {
          success: true,
          message: 'No batch details to write to Google Sheets',
          rowsWritten: 0,
          executionTime: Date.now() - startTime
        };
      }

      console.log(`\n📊 === GOOGLE SHEETS BATCHES WRITE OPERATION ===`);
      console.log(`Spreadsheet ID: ${this.config.spreadsheetId}`);
      console.log(`Sheet Name: ${this.config.batchesSheetName}`);
      console.log(`Batch details to write: ${batchDetailsArray.length}`);

      // Transform batch details to row format
      const rows = this.transformBatchDetailsToRows(batchDetailsArray);

      // Prepare the request
      const range = `${this.config.batchesSheetName}!A:A`; // Start from column A
      const valueInputOption = 'USER_ENTERED';

      // Append data to sheet
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: range,
        valueInputOption: valueInputOption,
        insertDataOption: 'INSERT_ROWS', // Insert new rows instead of overwriting
        requestBody: {
          values: rows
        }
      });

      const updatedRange = response.data.updates.updatedRange;
      const updatedRows = response.data.updates.updatedRows;

      console.log(`✅ Successfully wrote ${updatedRows} batch detail rows to ${updatedRange}`);
      console.log(`=== END GOOGLE SHEETS BATCHES WRITE OPERATION ===\n`);

      return {
        success: true,
        message: `Successfully wrote ${updatedRows} batch details to Google Sheets`,
        rowsWritten: updatedRows,
        updatedRange: updatedRange,
        executionTime: Date.now() - startTime,
        spreadsheetId: this.config.spreadsheetId,
        sheetName: this.config.batchesSheetName
      };

    } catch (error) {
      console.error('Error writing batch details to Google Sheets:', error.message);

      return {
        success: false,
        error: error.message,
        rowsWritten: 0,
        executionTime: Date.now() - startTime,
        spreadsheetId: this.config.spreadsheetId,
        sheetName: this.config.batchesSheetName
      };
    }
  }
}

module.exports = GoogleSheetsService;
