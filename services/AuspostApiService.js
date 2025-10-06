const axios = require('axios');

class AuspostApiService {
  constructor(lvlyConfig, bloomerooConfig) {
    // Store both credential sets
    this.LVLY_CONFIG = {
      url: lvlyConfig.url,
      accountNumbers: lvlyConfig.accountNumbers,
      authorization: lvlyConfig.authorization
    };

    this.BLOOMEROO_CONFIG = {
      url: bloomerooConfig.url,
      accountNumbers: bloomerooConfig.accountNumbers,
      authorization: bloomerooConfig.authorization
    };

    console.log(`\n🚀 === AUSPOST API SERVICE INITIALIZED ===`);
    console.log(`LVLY Configuration:`);
    console.log(`  API URL: ${this.LVLY_CONFIG.url}`);
    console.log(`  Account Numbers configured for locations: ${Object.keys(this.LVLY_CONFIG.accountNumbers).join(', ')}`);
    console.log(`  Authorization configured: ${this.LVLY_CONFIG.authorization ? 'YES' : 'NO'}`);
    console.log(`BLOOMEROO Configuration:`);
    console.log(`  API URL: ${this.BLOOMEROO_CONFIG.url}`);
    console.log(`  Account Numbers configured for locations: ${Object.keys(this.BLOOMEROO_CONFIG.accountNumbers).join(', ')}`);
    console.log(`  Authorization configured: ${this.BLOOMEROO_CONFIG.authorization ? 'YES' : 'NO'}`);
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

  async callAuspostAPI(orderData) {
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

      console.log(`\n📋 === FULL REQUEST PAYLOAD (JSON) ===`);
      console.log(JSON.stringify(requestPayload, null, 2));
      console.log(`=== END FULL PAYLOAD ===\n`);

      console.log(`\n🌐 Making POST request to: ${credentials.url}`);
      console.log(`📋 === REQUEST PARAMETERS ===`);
      console.log(`  URL: ${credentials.url}`);
      console.log(`  Account Number (header): ${credentials.accountNumber}`);
      console.log(`  Authorization (first 20 chars): ${credentials.authorization ? credentials.authorization.substring(0, 20) + '...' : 'NOT SET'}`);
      console.log(`  Content-Type: application/json`);
      console.log(`  Accept: application/json`);
      console.log(`  Timeout: 10000ms`);
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
      console.log(`Response Data:`, JSON.stringify(response.data, null, 2));

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
        error: error.response?.data?.message || error.message,
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

  /**
   * Process successful AusPost orders for label generation
   * Groups orders by location and transforms payload + response into label format
   * @param {Array} successfulOrders - Array of successful order results from AusPost API
   * @param {Object} finalBatchNumbers - Batch numbers per location
   * @returns {Object} Labels data grouped by location
   */
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

  /**
   * Transform AusPost API request/response into label format
   * Maps fields according to specification
   * @param {Object} order - Order result with requestPayload and responseData
   * @returns {Object} Transformed label data
   */
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
}

module.exports = AuspostApiService;
