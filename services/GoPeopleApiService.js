const axios = require('axios');

class GoPeopleApiService {
  constructor(apiTokenProd, apiTokenTest, apiUrlProd, apiUrlTest, devMode) {
    this.GOPEOPLE_API_TOKEN_PROD = apiTokenProd;
    this.GOPEOPLE_API_TOKEN_TEST = apiTokenTest;
    this.GOPEOPLE_API_URL_PROD = apiUrlProd;
    this.GOPEOPLE_API_URL_TEST = apiUrlTest;
    this.devMode = devMode;

    // dev_mode[0] selects credentials AND URL (does NOT control API execution)
    // dev_mode[0] = '1' → Production credentials and URL
    // dev_mode[0] = '0' → Test credentials and URL
    // APIs always execute if orders are available; dev_mode[0] only determines which environment to use
    const useProduction = devMode && devMode[0] === '1';
    this.GOPEOPLE_API_TOKEN = useProduction ? this.GOPEOPLE_API_TOKEN_PROD : this.GOPEOPLE_API_TOKEN_TEST;
    this.GOPEOPLE_API_URL = useProduction ? this.GOPEOPLE_API_URL_PROD : this.GOPEOPLE_API_URL_TEST;

    console.log(`\n🔑 === GOPEOPLE API CREDENTIALS & URL SELECTION ===`);
    console.log(`dev_mode: ${devMode}`);
    console.log(`dev_mode[0]: ${devMode ? devMode[0] : 'N/A'}`);
    console.log(`Using ${useProduction ? 'PRODUCTION' : 'TEST'} environment`);
    console.log(`Token configured: ${this.GOPEOPLE_API_TOKEN ? 'YES' : 'NO'}`);
    console.log(`API URL: ${this.GOPEOPLE_API_URL}`);
    console.log(`=== END CREDENTIALS & URL SELECTION ===\n`);
  }

  async callGoPeopleAPI(orderData) {
    try {
      console.log(`\n🚀 === GOPEOPLE API REQUEST ===`);
      console.log(`Order Number: ${orderData.orderNumber}`);
      console.log(`API URL: ${this.GOPEOPLE_API_URL}`);
      // console.log(`Request Payload:`, JSON.stringify(orderData.apiPayload, null, 2));
      console.log(`=== END GOPEOPLE API REQUEST ===\n`);

      const response = await axios.post(
        this.GOPEOPLE_API_URL,
        orderData.apiPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `bearer ${this.GOPEOPLE_API_TOKEN}`
          },
          timeout: 5000 // 5 second timeout
        }
      );

      console.log(`\n✅ === GOPEOPLE API RESPONSE ===`);
      console.log(`Order Number: ${orderData.orderNumber}`);
      console.log(`HTTP Status: ${response.status}`);
      console.log(`Error Code: ${response.data.errorCode}`);
      console.log(`Message: ${response.data.message}`);
      if (response.data.result) {
        console.log(`Job Number: ${response.data.result.number || 'N/A'}`);
        console.log(`Barcodes:`, response.data.result.barcodes || 'N/A');
        console.log(`Address To:`, JSON.stringify(response.data.result.addressTo, null, 2));
      }
      // console.log(`Full Response Data:`, JSON.stringify(response.data, null, 2));
      console.log(`=== END GOPEOPLE API RESPONSE ===\n`);

      const isSuccess = response.data.errorCode === 0 && (response.status === 200 || response.status === 201);

      const result = {
        orderNumber: orderData.orderNumber,
        success: isSuccess,
        error: `${response.data.errorCode}: ${response.data.message}`
      };

      // If successful, capture response data for label processing
      if (isSuccess && response.data.result) {
        result.responseData = response.data.result;
        result.location = orderData.location_name;
        result.deliveryDate = orderData.delivery_date;
      }

      return result;
    } catch (error) {
      console.log(`\n❌ === GOPEOPLE API ERROR ===`);
      console.log(`Order Number: ${orderData.orderNumber}`);
      console.log(`Error Type: ${error.name || 'Unknown'}`);
      console.log(`Error Message: ${error.message}`);
      if (error.response) {
        console.log(`HTTP Status: ${error.response.status}`);
        console.log(`Response Data:`, JSON.stringify(error.response.data, null, 2));
      }
      if (error.code) {
        console.log(`Error Code: ${error.code}`);
      }
      console.log(`=== END GOPEOPLE API ERROR ===\n`);

      return {
        orderNumber: orderData.orderNumber,
        success: false,
        error: error.message
      };
    }
  }

  async executeGoPeopleApiCalls(transformedData) {
    const results = [];
    const successfulOrders = [];
    let successCount = 0;
    let failureCount = 0;
    let processedCount = 0;

    for (const orderData of transformedData) {
      const apiResult = await this.callGoPeopleAPI(orderData);
      results.push(apiResult);
      processedCount++;

      if (apiResult.success) {
        successCount++;
        // Store successful orders for label processing
        successfulOrders.push(apiResult);
      } else {
        failureCount++;
      }

      // Small delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Process successful orders for label generation
    const gpLabelsData = this.processLabelsData(successfulOrders, null); // finalBatchNumbers will be passed from pipeline

    return {
      results,
      successfulOrders,
      gpLabelsData,
      summary: {
        total: processedCount,
        successful: successCount,
        failed: failureCount,
        processed: processedCount
      }
    };
  }

  transformResponseData(responseData) {
    try {
      const transformed = {
        address: responseData.addressTo?.address1 || '',
        suburb: responseData.addressTo?.suburb || '',
        state: responseData.addressTo?.state || '',
        postcode: responseData.addressTo?.postcode || '',
        contactName: responseData.addressTo?.contacts?.[0]?.contactName || '',
        barcode: responseData.barcodes?.[0]?.text || '',
        jobId: responseData.number || '',
        ref: responseData.ref || ''
      };

      return transformed;
    } catch (error) {
      console.error('Error transforming response data:', error);
      return null;
    }
  }

  processLabelsData(successfulOrders, finalBatchNumbers) {
    if (!successfulOrders || successfulOrders.length === 0) {
      return {};
    }

    console.log(`Processing ${successfulOrders.length} successful orders for label generation`);

    // Group orders by location
    const ordersByLocation = {};

    successfulOrders.forEach(order => {
      if (!order.responseData || !order.location) {
        console.warn(`Skipping order ${order.orderNumber} - missing response data or location`);
        return;
      }

      const location = order.location;
      if (!ordersByLocation[location]) {
        ordersByLocation[location] = [];
      }

      const transformedData = this.transformResponseData(order.responseData);
      if (transformedData) {
        ordersByLocation[location].push(transformedData);
      }
    });

    // Create batched JSON structures for each location
    const labelsByLocation = {};

    console.log(`Creating batched label data for ${Object.keys(ordersByLocation).length} locations...`);

    Object.keys(ordersByLocation).forEach(location => {
      const orders = ordersByLocation[location];

      console.log(`Processing ${location} with ${orders.length} orders`);

      // Get delivery date from first successful order for this location
      const sampleOrder = successfulOrders.find(o => o.location === location);
      const deliveryDate = sampleOrder?.deliveryDate || new Date().toISOString().split('T')[0];

      const gpLabelsDataArray = [];

      // Create batches of 12 orders each
      for (let i = 0; i < orders.length; i += 12) {
        const batchOrders = orders.slice(i, i + 12);
        const batchNumber = Math.floor(i / 12) + 1;

        // Convert array to object with gp1, gp2, gp3 keys
        const gpLabelsDataObject = {};
        batchOrders.forEach((order, index) => {
          const key = `gp${index + 1}`;
          gpLabelsDataObject[key] = order;
        });
        gpLabelsDataArray.push(gpLabelsDataObject);

        console.log(`  Created batch ${batchNumber} with ${batchOrders.length} orders`);
      }

      // Create single batch data per location (after processing all orders)
      const batchData = {
        location: location,
        delivery_date: deliveryDate,
        batch: finalBatchNumbers ? finalBatchNumbers[location] : 1,
        gp_labels_data: gpLabelsDataArray
      };

      labelsByLocation[location] = [batchData];
      console.log(`✅ Created label batches for ${location} with ${orders.length} total orders`);
    });

    return labelsByLocation;
  }
}

module.exports = GoPeopleApiService;