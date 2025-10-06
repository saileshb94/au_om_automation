const axios = require('axios');

class GoPeopleApiService {
  constructor(apiToken, apiUrl) {
    this.GOPEOPLE_API_TOKEN = apiToken;
    this.GOPEOPLE_API_URL = apiUrl;
  }

  async callGoPeopleAPI(orderData) {
    try {
      console.log(`Calling GoPeople API for order: ${orderData.orderNumber}`);
      // console.log(`Gopeople API payload:`, orderData.apiPayload);
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
      // console.log("GP Result: ", response.data.result);
      // console.log("GP barcode: ", response.data.result.barcodes);
      // console.log("GP to: ", response.data.result.addressTo);

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
      console.error(`GoPeople API call failed for order ${orderData.orderNumber}:`, error.message);

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
      const batches = [];

      console.log(`Processing ${location} with ${orders.length} orders`);

      // Create batches of 12 orders each
      for (let i = 0; i < orders.length; i += 12) {
        const batchOrders = orders.slice(i, i + 12);
        const batchNumber = Math.floor(i / 12) + 1;

        // Get delivery date from first successful order for this location
        const sampleOrder = successfulOrders.find(o => o.location === location);
        const deliveryDate = sampleOrder?.deliveryDate || new Date().toISOString().split('T')[0];

        // Convert array to object with gp1, gp2, gp3 keys
        const gpLabelsDataObject = {};
        batchOrders.forEach((order, index) => {
          const key = `gp${index + 1}`;
          gpLabelsDataObject[key] = order;
        });

        const batchData = {
          location: location,
          delivery_date: deliveryDate,
          batch: finalBatchNumbers ? finalBatchNumbers[location] : 1,
          gp_labels_data: [gpLabelsDataObject]
        };

        batches.push(batchData);
        console.log(`  Created batch ${batchNumber} with ${batchOrders.length} orders`);
      }

      if (batches.length > 0) {
        labelsByLocation[location] = batches;
        console.log(`✅ Created ${batches.length} label batches for ${location}`);
      }
    });

    return labelsByLocation;
  }
}

module.exports = GoPeopleApiService;