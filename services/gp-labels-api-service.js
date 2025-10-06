const axios = require('axios');
const { GP_LABELS_API_CONFIG } = require('../config');

class GpLabelsApiService {
  constructor() {
    this.config = GP_LABELS_API_CONFIG;
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async processGpLabelsData(gpLabelsData) {
    const results = {
      success: true,
      processedBatches: [],
      errors: [],
      summary: {
        totalBatches: 0,
        successfulCalls: 0,
        failedCalls: 0
      }
    };

    try {
      console.log('=== GpLabelsApiService Processing Started ===');

      if (!gpLabelsData || Object.keys(gpLabelsData).length === 0) {
        console.log('No GP labels data to process');
        return results;
      }

      console.log(`Processing GP labels data for ${Object.keys(gpLabelsData).length} locations`);

      // Process each location's batches
      for (const [location, batches] of Object.entries(gpLabelsData)) {
        console.log(`\n--- Processing ${location} with ${batches.length} batches ---`);

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          console.log(`\nProcessing batch ${i + 1}/${batches.length} for ${location}`);
          console.log(`Batch contains ${batch.gp_labels_data.length} labels`);

          results.summary.totalBatches++;

          try {
            const apiResult = await this.callGpLabelsApi(batch);
            console.log(`✅ API call successful for ${location} batch ${i + 1}`);

            results.processedBatches.push({
              location: location,
              batchIndex: i + 1,
              success: true,
              batch: batch,
              response: apiResult
            });
            results.summary.successfulCalls++;
          } catch (error) {
            console.error(`❌ API call failed for ${location} batch ${i + 1}:`, error.message);

            results.processedBatches.push({
              location: location,
              batchIndex: i + 1,
              success: false,
              batch: batch,
              error: error.message
            });
            results.errors.push(`${location} batch ${i + 1}: ${error.message}`);
            results.summary.failedCalls++;
          }

          // Small delay between API calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log('\n=== GP Labels Processing Summary ===');
      console.log(`Total batches processed: ${results.summary.totalBatches}`);
      console.log(`Successful API calls: ${results.summary.successfulCalls}`);
      console.log(`Failed API calls: ${results.summary.failedCalls}`);

      if (results.summary.failedCalls > 0) {
        results.success = false;
      }

      return results;

    } catch (error) {
      return {
        success: false,
        processedBatches: [],
        errors: [`Service initialization error: ${error.message}`],
        summary: {
          totalBatches: 0,
          successfulCalls: 0,
          failedCalls: 0
        }
      };
    }
  }

  async callGpLabelsApi(batchData) {
    console.log(`\n🔄 Making GP Labels API call for ${batchData.location} batch ${batchData.batch}`);

    const endpoint = this.config.endpoint;

    if (!endpoint) {
      console.error(`❌ No endpoint configuration found`);
      throw new Error('No endpoint configuration found');
    }

    console.log(`📡 Making API call to: ${endpoint.method} ${this.config.baseUrl}${endpoint.url}`);
    console.log(`📊 Processing ${batchData.location} batch ${batchData.batch} with ${batchData.gp_labels_data?.[0] ? Object.keys(batchData.gp_labels_data[0]).length : 0} labels`);

    let lastError;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${this.config.retryAttempts} for ${batchData.location} batch`);

      try {
        const response = await this.axiosInstance({
          method: endpoint.method,
          url: endpoint.url,
          data: batchData  // Send batch data directly
        });

        console.log(`✅ API call successful for ${batchData.location} batch - Status: ${response.status}`);

        return {
          statusCode: response.status,
          data: response.data,
          attempt: attempt,
          batchData: batchData
        };

      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed for ${batchData.location} batch:`, error.message);

        if (error.response) {
          console.error(`📄 HTTP Status: ${error.response.status}`);
          console.error(`📄 Response data:`, error.response.data);
        } else if (error.request) {
          console.error(`📡 No response received. Request details:`, {
            method: error.config?.method,
            url: error.config?.url,
            timeout: this.config.timeout
          });
        } else {
          console.error(`⚙️ Request setup error:`, error.message);
        }

        const shouldRetry = attempt < this.config.retryAttempts &&
          (error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT' ||
           (error.response && error.response.status >= 500));

        if (shouldRetry) {
          console.log(`🔄 Retrying in ${this.config.retryDelay * attempt}ms...`);
          await this.sleep(this.config.retryDelay * attempt);
          continue;
        } else {
          console.error(`🛑 Not retrying. Reason: ${shouldRetry ? 'Max attempts reached' : 'Non-retryable error'}`);
          break;
        }
      }
    }

    const errorMessage = lastError.response
      ? `HTTP ${lastError.response.status}: ${lastError.response.data?.message || lastError.message}`
      : lastError.message;

    console.error(`💥 Final error for ${batchData.location} batch: ${errorMessage}`);
    throw new Error(`API call failed after ${this.config.retryAttempts} attempts: ${errorMessage}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  validateConfiguration() {
    const issues = [];

    if (!this.config.baseUrl) {
      issues.push('Missing base URL configuration');
    }

    if (!this.config.endpoint) {
      issues.push('Missing endpoint configuration');
    }

    return {
      valid: issues.length === 0,
      issues: issues
    };
  }
}

module.exports = GpLabelsApiService;