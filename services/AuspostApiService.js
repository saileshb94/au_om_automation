const axios = require('axios');
const { AUSPOST_LABELS_CONFIG } = require('../config');

class AuspostApiService {
  constructor(lvlyConfig, bloomerooConfig, devMode) {
    this.devMode = devMode;

    // dev_mode[0] selects credentials (does NOT control API execution)
    // dev_mode[0] = '1' → Production credentials (url_prod, accountNumbers_prod, authorization_prod)
    // dev_mode[0] = '0' → Test credentials (url_test, accountNumbers_test, authorization_test)
    // APIs always execute if orders are available; dev_mode[0] only determines which environment to use
    const useProduction = devMode && devMode[0] === '1';

    // Store credential sets with URL, account numbers, and authorization selected based on dev_mode
    this.LVLY_CONFIG = {
      url: useProduction ? lvlyConfig.url_prod : lvlyConfig.url_test,
      accountNumbers: useProduction ? lvlyConfig.accountNumbers_prod : lvlyConfig.accountNumbers_test,
      authorization: useProduction ? lvlyConfig.authorization_prod : lvlyConfig.authorization_test
    };

    this.BLOOMEROO_CONFIG = {
      url: useProduction ? bloomerooConfig.url_prod : bloomerooConfig.url_test,
      accountNumbers: useProduction ? bloomerooConfig.accountNumbers_prod : bloomerooConfig.accountNumbers_test,
      authorization: useProduction ? bloomerooConfig.authorization_prod : bloomerooConfig.authorization_test
    };

    // Select labels API URL based on dev_mode[0]
    this.LABELS_API_URL = useProduction ? AUSPOST_LABELS_CONFIG.apiUrl_prod : AUSPOST_LABELS_CONFIG.apiUrl_test;

    console.log(`\n🚀 === AUSPOST API SERVICE INITIALIZED ===`);
    console.log(`dev_mode: ${devMode}`);
    console.log(`dev_mode[0]: ${devMode ? devMode[0] : 'N/A'}`);
    console.log(`Using ${useProduction ? 'PRODUCTION' : 'TEST'} credentials`);
    console.log(`\nLVLY Configuration:`);
    console.log(`  API URL: ${this.LVLY_CONFIG.url}`);
    console.log(`  Account Numbers configured for locations: ${Object.keys(this.LVLY_CONFIG.accountNumbers).join(', ')}`);
    console.log(`  Authorization configured: ${this.LVLY_CONFIG.authorization ? 'YES' : 'NO'}`);
    console.log(`\nBLOOMEROO Configuration:`);
    console.log(`  API URL: ${this.BLOOMEROO_CONFIG.url}`);
    console.log(`  Account Numbers configured for locations: ${Object.keys(this.BLOOMEROO_CONFIG.accountNumbers).join(', ')}`);
    console.log(`  Authorization configured: ${this.BLOOMEROO_CONFIG.authorization ? 'YES' : 'NO'}`);
    console.log(`\nLabels API:`);
    console.log(`  URL: ${this.LABELS_API_URL}`);
    console.log(`=== END INITIALIZATION ===\n`);
  }

  // Select credentials based on shop_id and location
  getCredentials(shop_id, location) {
    const config = shop_id === 6 ? this.BLOOMEROO_CONFIG : this.LVLY_CONFIG;
    const brandName = shop_id === 6 ? 'Bloomeroo' : 'LVLY';

    // Get location-specific account number
    const accountNumber = config.accountNumbers[location] || config.accountNumbers['Melbourne']; // Fallback to Melbourne

    console.log(`📋 Using ${brandName} credentials for shop_id=${shop_id}, location=${location}`);
    console.log(`   Account Number: ${accountNumber}`);

    return {
      url: config.url,
      accountNumber: accountNumber,
      authorization: config.authorization
    };
  }

  // Extract detailed error messages from AusPost API error responses
  extractAuspostError(error) {
    // Handle AusPost error response structure
    if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
      // Multiple validation errors array
      return error.response.data.errors
        .map(e => `${e.field || 'unknown'}: ${e.message || e.name || 'Unknown error'}`)
        .join(' | ');
    } else if (error.response?.data?.message) {
      // Single error message
      return error.response.data.message;
    } else if (error.response?.data?.error) {
      // Alternative error format
      return error.response.data.error;
    }
    // Fallback to generic message
    return error.message;
  }

  async callAuspostAPI(orderData) {
    console.log(`\n📋 orDerData ===`);
    console.log(orderData);
    try {
      console.log(`\n📮 === CALLING AUSPOST API ===`);
      console.log(`Order Number: ${orderData.orderNumber}`);
      console.log(`Location: ${orderData.location_name}`);
      console.log(`Delivery Date: ${orderData.delivery_date}`);
      console.log(`Shop ID: ${orderData.shop_id}`);
      console.log(`Store: ${orderData.store}`);

      // Select credentials based on shop_id and location
      const credentials = this.getCredentials(orderData.shop_id, orderData.location_name);

      // Wrap the shipment in the shipments array as required by Auspost API
      const requestPayload = {
        shipments: [orderData.apiPayload]
      };

      console.log(`\n📦 Request Payload Preview:`);
      console.log(`  Shipment Reference: ${orderData.apiPayload.shipment_reference}`);
      console.log(`  From: ${orderData.apiPayload.from.name}, ${orderData.apiPayload.from.suburb} ${orderData.apiPayload.from.state}`);
      console.log(`  To: ${orderData.apiPayload.to.name}, ${orderData.apiPayload.to.suburb} ${orderData.apiPayload.to.state}`);
      console.log(`  Items: ${orderData.apiPayload.items.length} item(s)`);

      // console.log(`\n📋 === FULL REQUEST PAYLOAD (JSON) ===`);
      // console.log(JSON.stringify(requestPayload, null, 2));
      // console.log(`=== END FULL PAYLOAD ===\n`);

      console.log(`\n🌐 Making POST request to: ${credentials.url}`);
      console.log(`📋 === REQUEST PARAMETERS ===`);
      console.log(`  URL: ${credentials.url}`);
      console.log(`  Account Number (header): ${credentials.accountNumber}`);
      // console.log(`  Authorization (first 20 chars): ${credentials.authorization ? credentials.authorization.substring(0, 20) + '...' : 'NOT SET'}`);
      // console.log(`  Content-Type: application/json`);
      // console.log(`  Accept: application/json`);
      // console.log(`  Timeout: 10000ms`);
      console.log(`=== END REQUEST PARAMETERS ===\n`);

      const response = await axios.post(
        credentials.url,
        requestPayload,
        {
          headers: {
            'Account-Number': credentials.accountNumber,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': credentials.authorization
          },
          timeout: 10000 // 10 second timeout
        }
      );

      console.log(`\n✅ === AUSPOST API RESPONSE SUCCESS ===`);
      console.log(`Status Code: ${response.status}`);
      // console.log(`Response Data:`, JSON.stringify(response.data, null, 2));

      // Check if response indicates success
      const isSuccess = response.status === 200 || response.status === 201;

      const result = {
        orderNumber: orderData.orderNumber,
        success: isSuccess,
        httpStatus: response.status,
        responseData: response.data,
        requestPayload: orderData.apiPayload, // Store original request payload for labels
        location: orderData.location_name,
        deliveryDate: orderData.delivery_date,
        shop_id: orderData.shop_id // Store shop_id for brand separation
      };

      if (isSuccess) {
        console.log(`✅ Order ${orderData.orderNumber} submitted successfully to Auspost`);

        // Extract key info from response
        if (response.data.shipments && response.data.shipments.length > 0) {
          const shipment = response.data.shipments[0];
          console.log(`  Shipment ID: ${shipment.shipment_id || 'N/A'}`);
          console.log(`  Tracking ID: ${shipment.tracking_details?.tracking_id || 'N/A'}`);
          result.shipmentId = shipment.shipment_id;
          result.trackingId = shipment.tracking_details?.tracking_id;
        }
      } else {
        console.log(`⚠️ Order ${orderData.orderNumber} - unexpected status: ${response.status}`);
        result.error = `Unexpected status code: ${response.status}`;
      }

      console.log(`=== END AUSPOST API RESPONSE ===\n`);

      return result;

    } catch (error) {
      console.error(`\n❌ === AUSPOST API ERROR ===`);
      console.error(`Order Number: ${orderData.orderNumber}`);
      console.error(`Shop ID: ${orderData.shop_id}`);
      console.error(`Store: ${orderData.store}`);
      console.error(`Error Type: ${error.name}`);
      console.error(`Error Message: ${error.message}`);

      // Log the credentials used for this request
      const credentials = this.getCredentials(orderData.shop_id, orderData.location_name);
      console.error(`\n📋 === CREDENTIALS USED IN FAILED REQUEST ===`);
      console.error(`  URL: ${credentials.url}`);
      console.error(`  Account Number: ${credentials.accountNumber}`);
      console.error(`  Location: ${orderData.location_name}`);
      console.error(`  Authorization configured: ${credentials.authorization ? 'YES' : 'NO'}`);
      console.error(`  Authorization (first 20 chars): ${credentials.authorization ? credentials.authorization.substring(0, 20) + '...' : 'NOT SET'}`);
      console.error(`=== END CREDENTIALS INFO ===\n`);

      if (error.response) {
        console.error(`HTTP Status: ${error.response.status}`);
        console.error(`Response Data:`, JSON.stringify(error.response.data, null, 2));
        console.error(`Response Headers:`, JSON.stringify(error.response.headers, null, 2));
      }

      if (error.config) {
        console.error(`\n📤 === REQUEST CONFIG DETAILS ===`);
        console.error(`  Request URL: ${error.config.url}`);
        console.error(`  Request Method: ${error.config.method}`);
        console.error(`  Request Headers:`, JSON.stringify(error.config.headers, null, 2));
        console.error(`=== END REQUEST CONFIG ===\n`);
      }

      console.error(`=== END AUSPOST API ERROR ===\n`);

      return {
        orderNumber: orderData.orderNumber,
        success: false,
        error: this.extractAuspostError(error),
        httpStatus: error.response?.status || 0,
        errorDetails: error.response?.data || null,
        requestPayload: orderData.apiPayload, // Store payload even on error
        location: orderData.location_name,
        deliveryDate: orderData.delivery_date,
        shop_id: orderData.shop_id
      };
    }
  }

  async executeAuspostApiCalls(transformedData) {
    console.log(`\n🔄 === AUSPOST API EXECUTION START ===`);
    console.log(`Total orders to process: ${transformedData.length}`);

    const results = [];
    const successfulOrders = [];
    let successCount = 0;
    let failureCount = 0;
    let processedCount = 0;

    for (const orderData of transformedData) {
      console.log(`\n📍 Processing ${processedCount + 1}/${transformedData.length}: Order ${orderData.orderNumber}`);

      const apiResult = await this.callAuspostAPI(orderData);
      results.push(apiResult);
      processedCount++;

      if (apiResult.success) {
        successCount++;
        successfulOrders.push(apiResult);
        console.log(`✅ SUCCESS - Total successful: ${successCount}/${processedCount}`);
      } else {
        failureCount++;
        console.log(`❌ FAILED - Total failed: ${failureCount}/${processedCount}`);
        console.log(`   Error: ${apiResult.error}`);
      }

      // Small delay between API calls to avoid rate limiting
      if (processedCount < transformedData.length) {
        console.log(`⏳ Waiting 200ms before next API call...`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`\n📊 === AUSPOST API EXECUTION SUMMARY ===`);
    console.log(`Total Processed: ${processedCount}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
    console.log(`Success Rate: ${processedCount > 0 ? ((successCount / processedCount) * 100).toFixed(1) : 0}%`);
    console.log(`=== END AUSPOST API EXECUTION ===\n`);

    return {
      results,
      successfulOrders,
      summary: {
        total: processedCount,
        successful: successCount,
        failed: failureCount,
        processed: processedCount
      }
    };
  }

  // ============================================================================
  // OLD LABEL GENERATION METHODS (COMMENTED OUT - DO NOT DELETE)
  // These methods used DocuPilot API for label generation
  // Kept for reference and potential rollback
  // ============================================================================

  /*
   * OLD METHOD - Process successful AusPost orders for label generation
   * Groups orders by location and transforms payload + response into label format
   * @param {Array} successfulOrders - Array of successful order results from AusPost API
   * @param {Object} finalBatchNumbers - Batch numbers per location
   * @returns {Object} Labels data grouped by location

  processLabelsData(successfulOrders, finalBatchNumbers) {
    if (!successfulOrders || successfulOrders.length === 0) {
      console.log('ℹ️  No successful AusPost orders to process for labels');
      return {};
    }

    console.log(`\n🏷️  === PROCESSING AUSPOST LABELS DATA ===`);
    console.log(`📊 Processing ${successfulOrders.length} successful orders for label generation`);

    // Group orders by location (not by brand - combined for LVLY and Bloomeroo)
    const ordersByLocation = {};

    successfulOrders.forEach(order => {
      if (!order.responseData || !order.requestPayload || !order.location) {
        console.warn(`⚠️  Skipping order ${order.orderNumber} - missing response data, request payload, or location`);
        return;
      }

      const location = order.location;
      if (!ordersByLocation[location]) {
        ordersByLocation[location] = [];
      }

      const transformedLabel = this.transformToLabelFormat(order);
      if (transformedLabel) {
        ordersByLocation[location].push(transformedLabel);
      }
    });

    // Create location-based JSON structures with metadata
    const labelsByLocation = {};

    console.log(`📍 Creating label data for ${Object.keys(ordersByLocation).length} locations...`);

    Object.keys(ordersByLocation).forEach(location => {
      const items = ordersByLocation[location];

      // Get delivery date from first order for this location
      const sampleOrder = successfulOrders.find(o => o.location === location);
      const deliveryDate = sampleOrder?.deliveryDate || new Date().toISOString().split('T')[0];

      const locationData = {
        location: location,
        delivery_date: deliveryDate,
        batch: finalBatchNumbers ? finalBatchNumbers[location] : 1,
        items: items
      };

      labelsByLocation[location] = locationData;
      console.log(`✅ Created label data for ${location}: ${items.length} items, batch ${locationData.batch}, date ${deliveryDate}`);
    });

    console.log(`🎉 Total locations with label data: ${Object.keys(labelsByLocation).length}`);
    console.log(`=== END AUSPOST LABELS DATA PROCESSING ===\n`);

    return labelsByLocation;
  }

  /*
   * Transform AusPost API request/response into label format
   * Maps fields according to specification
   * @param {Object} order - Order result with requestPayload and responseData
   * @returns {Object} Transformed label data

  transformToLabelFormat(order) {
    try {
      const payload = order.requestPayload;
      const response = order.responseData;

      // Navigate to shipment and item data
      const shipment = response.shipments?.[0];
      const item = shipment?.items?.[0];
      const labelMetadata = item?.label_metadata;

      if (!shipment || !item || !labelMetadata) {
        console.warn(`⚠️  Order ${order.orderNumber}: Missing shipment/item/label_metadata in response`);
        return null;
      }

      // Extract and concatenate 'to' lines array
      const toLines = Array.isArray(payload.to.lines)
        ? payload.to.lines.join(', ')
        : payload.to.lines || '';

      // Extract and concatenate 'from' lines array
      const fromLines = Array.isArray(payload.from.lines)
        ? payload.from.lines.join(', ')
        : payload.from.lines || '';

      // Convert shipment_creation_date to yyyy-mm-dd format
      let formattedDate = '';
      if (shipment.shipment_creation_date) {
        const dateObj = new Date(shipment.shipment_creation_date);
        formattedDate = dateObj.toISOString().split('T')[0]; // yyyy-mm-dd
      }

      const transformed = {
        qr: labelMetadata.qr_2d_barcode || '',
        to: {
          name: payload.to.name || '',
          lines: toLines,
          phone: payload.to.phone || '',
          state: payload.to.state || '',
          suburb: payload.to.suburb || '',
          postcode: payload.to.postcode || '',
          business_name: payload.to.business_name || ''
        },
        atl: item.atl_number || '',
        date: formattedDate,
        from: {
          name: payload.from.name || '',
          lines: fromLines,
          phone: payload.from.phone || '',
          state: payload.from.state || '',
          suburb: payload.from.suburb || '',
          postcode: payload.from.postcode || '',
          business_name: payload.from.name || '' // Use from.name as business_name per spec
        },
        conid: labelMetadata.consignment_id || '',
        p_port: labelMetadata.primary_port || '',
        s_port: labelMetadata.secondary_port || '',
        weight: item.weight ? `${item.weight}kg` : '',
        reference: shipment.shipment_reference || '',
        article_id: labelMetadata.article_id || '',
        packaging_type: payload.items?.[0]?.packaging_type || '',
        routing_barcode: labelMetadata.routing_barcode || ''
      };

      console.log(`✅ Transformed order ${order.orderNumber} to label format`);

      return transformed;
    } catch (error) {
      console.error(`❌ Error transforming order ${order.orderNumber} to label format:`, error.message);
      return null;
    }
  }
  */

  // ============================================================================
  // NEW LABEL GENERATION METHODS
  // Uses AusPost Labels API to generate labels and download PDFs
  // ============================================================================

  /**
   * Extract shipment_id and item_id from successful AusPost API responses
   * @param {Array} successfulOrders - Array of successful order results from AusPost API
   * @returns {Array} Array of {shipment_id, item_id, orderNumber, location, deliveryDate, shop_id}
   */
  extractShipmentItemIds(successfulOrders) {
    console.log(`\n🔍 === EXTRACTING SHIPMENT/ITEM IDs ===`);
    console.log(`Processing ${successfulOrders.length} successful orders`);

    const extractedData = [];

    for (const order of successfulOrders) {
      try {
        // Navigate to shipment and item data in response
        const shipment = order.responseData?.shipments?.[0];
        const item = shipment?.items?.[0];

        if (!shipment || !item) {
          console.warn(`⚠️  Order ${order.orderNumber}: Missing shipment or item data in response`);
          continue;
        }

        const shipmentId = shipment.shipment_id;
        const itemId = item.item_id;

        if (!shipmentId || !itemId) {
          console.warn(`⚠️  Order ${order.orderNumber}: Missing shipment_id or item_id`);
          continue;
        }

        extractedData.push({
          shipment_id: shipmentId,
          item_id: itemId,
          orderNumber: order.orderNumber,
          location: order.location,
          deliveryDate: order.deliveryDate,
          shop_id: order.shop_id
        });

        console.log(`✅ Extracted - Order: ${order.orderNumber}, Shipment: ${shipmentId}, Item: ${itemId}`);
      } catch (error) {
        console.error(`❌ Error extracting IDs for order ${order.orderNumber}:`, error.message);
      }
    }

    console.log(`\n📊 Extraction Summary:`);
    console.log(`  Total orders processed: ${successfulOrders.length}`);
    console.log(`  Successfully extracted: ${extractedData.length}`);
    console.log(`  Failed: ${successfulOrders.length - extractedData.length}`);
    console.log(`=== END EXTRACTION ===\n`);

    return extractedData;
  }

  /**
   * Call AusPost Labels API to generate labels
   * @param {Array} shipmentItems - Array of {shipment_id, item_id} objects
   * @param {Object} credentials - AusPost credentials (authorization, accountNumber)
   * @returns {Promise<Object>} API response with label URLs
   */
  async callLabelsAPI(shipmentItems, credentials) {
    console.log(`\n📮 === CALLING AUSPOST LABELS API ===`);
    console.log(`Generating labels for ${shipmentItems.length} shipments`);

    // Build the API payload
    const payload = {
      wait_for_label_url: AUSPOST_LABELS_CONFIG.wait_for_label_url,
      unlabelled_articles_only: AUSPOST_LABELS_CONFIG.unlabelled_articles_only,
      preferences: AUSPOST_LABELS_CONFIG.preferences,
      shipments: shipmentItems.map(item => ({
        shipment_id: item.shipment_id,
        items: [{ item_id: item.item_id }]
      }))
    };

    console.log(`\n📦 Request Payload:`);
    console.log(`  URL: ${this.LABELS_API_URL}`);
    console.log(`  Shipments count: ${payload.shipments.length}`);
    console.log(`  Wait for label URL: ${payload.wait_for_label_url}`);
    // console.log(`\n📋 Full Payload:`, JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(
        this.LABELS_API_URL,
        payload,
        {
          headers: {
            'Account-Number': credentials.accountNumber,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': credentials.authorization
          },
          timeout: AUSPOST_LABELS_CONFIG.timeout
        }
      );

      console.log(`\n✅ === AUSPOST LABELS API SUCCESS ===`);
      console.log(`Status Code: ${response.status}`);
      console.log(`Response:`, JSON.stringify(response.data, null, 2));
      console.log(`=== END LABELS API RESPONSE ===\n`);

      return {
        success: true,
        httpStatus: response.status,
        data: response.data
      };

    } catch (error) {
      console.error(`\n❌ === AUSPOST LABELS API ERROR ===`);
      console.error(`Error Type: ${error.name}`);
      console.error(`Error Message: ${error.message}`);

      if (error.response) {
        console.error(`HTTP Status: ${error.response.status}`);
        console.error(`Response Data:`, JSON.stringify(error.response.data, null, 2));
      }

      console.error(`=== END LABELS API ERROR ===\n`);

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        httpStatus: error.response?.status || 0,
        errorDetails: error.response?.data || null
      };
    }
  }

  /**
   * Process successful orders for new label generation flow
   * Groups orders by location, calls Labels API, and returns label URLs
   * @param {Array} successfulOrders - Array of successful order results from AusPost API
   * @param {Object} finalBatchNumbers - Batch numbers per location
   * @returns {Object} Label URLs grouped by location with metadata
   */
  async processNewLabelsGeneration(successfulOrders, finalBatchNumbers) {
    if (!successfulOrders || successfulOrders.length === 0) {
      console.log('ℹ️  No successful AusPost orders to process for labels');
      return {};
    }

    console.log(`\n🏷️  === NEW AUSPOST LABELS GENERATION PROCESS ===`);
    console.log(`📊 Processing ${successfulOrders.length} successful orders for label generation`);

    // Step 1: Extract shipment_id and item_id from all successful orders
    const extractedData = this.extractShipmentItemIds(successfulOrders);

    if (extractedData.length === 0) {
      console.log('❌ No valid shipment/item IDs extracted');
      return {};
    }

    // Step 2: Group by location
    const ordersByLocation = {};
    extractedData.forEach(item => {
      if (!ordersByLocation[item.location]) {
        ordersByLocation[item.location] = [];
      }
      ordersByLocation[item.location].push(item);
    });

    console.log(`\n📍 Grouped orders into ${Object.keys(ordersByLocation).length} locations`);

    // Step 3: Call Labels API for each location
    const labelsByLocation = {};

    for (const [location, items] of Object.entries(ordersByLocation)) {
      console.log(`\n📍 === Processing ${location} with ${items.length} items ===`);

      // Get credentials for the first order in this location (all should have same shop_id)
      const sampleOrder = successfulOrders.find(o => o.location === location);
      const credentials = this.getCredentials(sampleOrder.shop_id, location);

      // Call Labels API
      const apiResult = await this.callLabelsAPI(items, credentials);

      if (apiResult.success) {
        // Extract label URL from response
        const labelUrl = apiResult.data?.labels?.[0]?.url;

        if (labelUrl) {
          const deliveryDate = sampleOrder?.deliveryDate || new Date().toISOString().split('T')[0];
          const batch = finalBatchNumbers ? finalBatchNumbers[location] : 1;

          labelsByLocation[location] = {
            location: location,
            delivery_date: deliveryDate,
            batch: batch,
            isSameDay: "next-day",
            label_url: labelUrl,
            items_count: items.length,
            orders: items.map(i => i.orderNumber),
            shop_id: sampleOrder.shop_id,
            apiResponse: apiResult.data
          };

          console.log(`✅ ${location}: Label URL received - ${labelUrl}`);
        } else {
          console.warn(`⚠️  ${location}: No label URL in API response`);
        }
      } else {
        console.error(`❌ ${location}: Labels API call failed - ${apiResult.error}`);
      }

      // Small delay between API calls
      if (Object.keys(ordersByLocation).length > 1) {
        console.log(`⏳ Waiting 500ms before next location...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n🎉 Labels generation completed for ${Object.keys(labelsByLocation).length} locations`);
    console.log(`=== END NEW LABELS GENERATION ===\n`);

    return labelsByLocation;
  }
}

module.exports = AuspostApiService;
