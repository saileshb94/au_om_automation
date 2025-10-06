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
    const timestamp = new Date().toISOString();

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
}

module.exports = GoogleSheetsService;
