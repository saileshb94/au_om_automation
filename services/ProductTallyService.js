const axios = require('axios');
const { PRODUCT_TALLY_API_CONFIG, PRODUCT_TALLY_RULES } = require('../config');

class ProductTallyService {
  constructor() {
    this.config = PRODUCT_TALLY_API_CONFIG;
    this.rules = PRODUCT_TALLY_RULES;
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Main method to calculate tallies and submit to API
   * @param {Array} orderTrackingArray - Array of orders with successful logistics status
   * @param {string} deliveryDate - Delivery date in YYYY-MM-DD format
   * @param {Object} finalBatchNumbers - Batch numbers per location
   * @param {boolean} executeApiCall - Whether to actually call the API (dev_mode flag)
   * @param {string} isSameDay - Same-day delivery flag ("0" or "1")
   * @returns {Object} Results object with success status and details
   */
  async calculateAndSubmitTallies(orderTrackingArray, deliveryDate, finalBatchNumbers, executeApiCall, isSameDay) {
    const startTime = Date.now();

    console.log('=== PRODUCT TALLY SERVICE START ===');
    console.log(`Input: ${orderTrackingArray.length} orders`);
    console.log(`API calls: ${executeApiCall ? 'ENABLED' : 'DISABLED (calculation only)'}`);

    const results = {
      success: true,
      locationsProcessed: [],
      apiCalls: {
        success: 0,
        failed: 0
      },
      errors: [],
      calculations: {},
      executionTime: 0
    };

    try {
      // Group orders by location
      const ordersByLocation = this.groupOrdersByLocation(orderTrackingArray);

      console.log(`Locations with orders: ${Object.keys(ordersByLocation).join(', ')} (${Object.keys(ordersByLocation).length} total)`);

      // Process each location
      for (const [location, orders] of Object.entries(ordersByLocation)) {
        console.log(`\n--- Location: ${location} (Batch ${finalBatchNumbers[location]}) ---`);
        console.log(`Orders: ${orders.length} | Processing product tallies...`);

        // Calculate tallies for this location
        const tallies = this.calculateTalliesForLocation(orders, location);

        // Store calculation results
        results.calculations[location] = {
          batch: finalBatchNumbers[location],
          tallies: tallies
        };

        // Build API payload
        const tablesData = this.formatTalliesForApi(tallies);
        const deliveryType = isSameDay === '1' ? 'same-day' : 'next-day';
        const payload = {
          location: location,
          delivery_date: deliveryDate,
          batch: finalBatchNumbers[location],
          isSameDay: deliveryType,
          ...tablesData
        };

        console.log(`\nCalculated tallies for ${location}:`);
        // console.log(JSON.stringify(tablesData, null, 2));

        // Make API call if enabled
        if (executeApiCall) {
          try {
            console.log(`\nAPI Call → ${location}:`);
            console.log(`  POST ${this.config.endpoint.url}`);
            console.log(`  Payload: {location: '${location}', date: '${deliveryDate}', batch: ${finalBatchNumbers[location]}, ${this.rules.tables.length} table(s) flattened}`);

            const apiResult = await this.callTallyApi(payload);

            console.log(`  ✅ Response: ${apiResult.status} ${apiResult.statusText} (${apiResult.executionTime}ms)`);

            results.apiCalls.success++;
            results.locationsProcessed.push({
              location: location,
              success: true,
              executionTime: apiResult.executionTime
            });
          } catch (error) {
            console.error(`  ❌ API call failed for ${location}:`, error.message);

            results.success = false;
            results.apiCalls.failed++;
            results.errors.push({
              location: location,
              error: error.message
            });
            results.locationsProcessed.push({
              location: location,
              success: false,
              error: error.message
            });
          }
        } else {
          console.log(`\n⏭️  API call skipped for ${location} (dev_mode flag = 0)`);
          results.locationsProcessed.push({
            location: location,
            success: true,
            skipped: true
          });
        }
      }

    } catch (error) {
      console.error('❌ Error in Product Tally Service:', error.message);
      results.success = false;
      results.errors.push({
        location: 'service_level',
        error: error.message
      });
    }

    results.executionTime = Date.now() - startTime;

    console.log('\n=== PRODUCT TALLY SERVICE COMPLETE ===');
    console.log(`Locations processed: ${results.locationsProcessed.length}`);
    if (executeApiCall) {
      console.log(`API calls: ${results.apiCalls.success} success, ${results.apiCalls.failed} failed`);
    } else {
      console.log(`API calls: skipped (dev_mode flag = 0)`);
    }
    console.log(`Total time: ${results.executionTime}ms`);

    return results;
  }

  /**
   * Group orders by location
   * @param {Array} orders - Array of order objects
   * @returns {Object} Orders grouped by location
   */
  groupOrdersByLocation(orders) {
    const grouped = {};

    orders.forEach(order => {
      if (!order.location) {
        console.warn(`⚠️  Order ${order.order_number} has no location, skipping`);
        return;
      }

      if (!grouped[order.location]) {
        grouped[order.location] = [];
      }

      grouped[order.location].push(order);
    });

    return grouped;
  }

  /**
   * Calculate tallies for a specific location
   * @param {Array} orders - Orders for this location
   * @param {string} location - Location name
   * @returns {Object} Tallies organized by table
   */
  calculateTalliesForLocation(orders, location) {
    const tallies = {};

    // Extract all product names from orders
    const allProducts = [];
    orders.forEach(order => {
      if (order.order_products && typeof order.order_products === 'string') {
        // Split by comma and trim
        const products = order.order_products.split(',').map(p => p.trim()).filter(p => p);
        allProducts.push(...products);
      }
    });

    console.log(`Total product items: ${allProducts.length}`);

    // Process each table in the rules
    this.rules.tables.forEach(table => {
      // console.log(`\nTable: ${table.name}`);

      tallies[table.name] = {};

      // Process each row in the table
      table.rows.forEach(row => {
        if (row.type === 'simple') {
          // Simple row: label → single count value
          // console.log(`  Row: ${row.label} (simple)`);
          const count = this.countMatchingProducts(allProducts, row.searchTexts, row.label);
          tallies[table.name][row.label] = count;
        } else if (row.type === 'complex') {
          // Complex row: label → nested object with multiple fields
          // console.log(`  Row: ${row.label} (complex, ${row.fields.length} field(s))`);
          tallies[table.name][row.label] = {};

          row.fields.forEach(field => {
            const count = this.countMatchingProducts(allProducts, field.searchTexts, field.fieldName);
            tallies[table.name][row.label][field.fieldName] = count;
          });
        } else {
          console.warn(`  ⚠️  Unknown row type '${row.type}' for row '${row.label}', skipping`);
        }
      });
    });

    return tallies;
  }

  /**
   * Count products matching search texts
   * @param {Array} products - Array of product names
   * @param {Array} searchTexts - Array of search strings (OR logic)
   * @param {string} label - Field/row label for logging
   * @returns {number} Count of matching products
   */
  countMatchingProducts(products, searchTexts, label) {
    let count = 0;

    // console.log(`    Field: ${label}`);
    // console.log(`      Search: [${searchTexts.map(t => `'${t}'`).join(', ')}] (OR logic - case-insensitive substring)`);

    products.forEach(productName => {
      const productLower = productName.toLowerCase();

      // Check if product matches any search text (OR logic)
      const matches = searchTexts.some(searchText =>
        productLower.includes(searchText.toLowerCase())
      );

      if (matches) {
        count++;
      }
    });

    // console.log(`      Matches: ${count} product item(s)`);
    // console.log(`      Count: ${count}`);

    return count;
  }

  /**
   * Format tallies into API payload structure
   * @param {Object} tallies - Tallies organized by table
   * @returns {Object} Flat object with table names as keys
   */
  formatTalliesForApi(tallies) {
    const formattedTables = {};

    for (const [tableName, rows] of Object.entries(tallies)) {
      formattedTables[tableName] = rows;
    }

    return formattedTables;
  }

  /**
   * Make API call to submit tallies
   * @param {Object} payload - API payload
   * @returns {Object} API response details
   */
  async callTallyApi(payload) {
    const startTime = Date.now();

    let attempt = 0;
    let lastError = null;

    // Retry logic
    while (attempt < this.config.retryAttempts) {
      try {
        const response = await this.axiosInstance.post(
          this.config.endpoint.url,
          payload
        );

        const executionTime = Date.now() - startTime;

        return {
          success: true,
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          executionTime: executionTime
        };

      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt < this.config.retryAttempts) {
          console.log(`    ⚠️  Attempt ${attempt} failed, retrying in ${this.config.retryDelay}ms...`);
          await this.delay(this.config.retryDelay);
        }
      }
    }

    // All retries failed
    throw new Error(`API call failed after ${this.config.retryAttempts} attempts: ${lastError.message}`);
  }

  /**
   * Delay helper for retry logic
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ProductTallyService;
