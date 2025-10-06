const axios = require('axios');
const { AUSPOST_LABELS_API_CONFIG } = require('../config');

class AuspostLabelsApiService {
  constructor() {
    this.config = AUSPOST_LABELS_API_CONFIG;
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async processAuspostLabelsData(auspostLabelsData) {
    const results = {
      success: true,
      processedLocations: [],
      errors: [],
      summary: {
        totalLocations: 0,
        successfulCalls: 0,
        failedCalls: 0
      }
    };

    try {
      console.log('\n🏷️  === AuspostLabelsApiService Processing Started ===');

      if (!auspostLabelsData || Object.keys(auspostLabelsData).length === 0) {
        console.log('ℹ️  No AusPost labels data to process');
        return results;
      }

      console.log(`📊 Processing AusPost labels data for ${Object.keys(auspostLabelsData).length} locations`);

      // Process each location's label data
      for (const [location, locationData] of Object.entries(auspostLabelsData)) {
        console.log(`\n📍 --- Processing ${location} with ${locationData.items.length} items ---`);

        results.summary.totalLocations++;

        try {
          const apiResult = await this.callAuspostLabelsApi(locationData);
          console.log(`✅ API call successful for ${location}`);

          results.processedLocations.push({
            location: location,
            success: true,
            locationData: locationData,
            response: apiResult
          });
          results.summary.successfulCalls++;
        } catch (error) {
          console.error(`❌ API call failed for ${location}:`, error.message);

          results.processedLocations.push({
            location: location,
            success: false,
            locationData: locationData,
            error: error.message
          });
          results.errors.push(`${location}: ${error.message}`);
          results.summary.failedCalls++;
        }

        // Small delay between API calls to avoid rate limiting
        if (results.summary.totalLocations < Object.keys(auspostLabelsData).length) {
          console.log(`⏳ Waiting 200ms before next API call...`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log('\n📊 === AusPost Labels Processing Summary ===');
      console.log(`Total locations processed: ${results.summary.totalLocations}`);
      console.log(`Successful API calls: ${results.summary.successfulCalls}`);
      console.log(`Failed API calls: ${results.summary.failedCalls}`);

      if (results.summary.failedCalls > 0) {
        results.success = false;
      }

      console.log('=== END AusPost Labels Processing ===\n');

      return results;

    } catch (error) {
      console.error('💥 AuspostLabelsApiService error:', error.message);
      return {
        success: false,
        processedLocations: [],
        errors: [`Service initialization error: ${error.message}`],
        summary: {
          totalLocations: 0,
          successfulCalls: 0,
          failedCalls: 0
        }
      };
    }
  }

  async callAuspostLabelsApi(locationData) {
    console.log(`\n🔄 Making AusPost Labels API call for ${locationData.location}`);

    const endpoint = this.config.endpoint;

    if (!endpoint) {
      console.error(`❌ No endpoint configuration found`);
      throw new Error('No endpoint configuration found');
    }

    console.log(`📡 API Endpoint: ${endpoint.method} ${this.config.baseUrl}${endpoint.url}`);
    console.log(`📦 Location: ${locationData.location}`);
    console.log(`📅 Delivery Date: ${locationData.delivery_date}`);
    console.log(`🔢 Batch: ${locationData.batch}`);
    console.log(`📋 Items count: ${locationData.items.length}`);

    let lastError;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${this.config.retryAttempts} for ${locationData.location}`);

      try {
        const response = await this.axiosInstance({
          method: endpoint.method,
          url: endpoint.url,
          data: locationData  // Send location data with metadata
        });

        console.log(`✅ API call successful for ${locationData.location} - Status: ${response.status}`);
        console.log(`📄 Response data:`, JSON.stringify(response.data, null, 2));

        return {
          statusCode: response.status,
          data: response.data,
          attempt: attempt,
          locationData: locationData
        };

      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed for ${locationData.location}:`, error.message);

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
          console.error(`⚙️  Request setup error:`, error.message);
        }

        const shouldRetry = attempt < this.config.retryAttempts &&
          (error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT' ||
           (error.response && error.response.status >= 500));

        if (shouldRetry) {
          const delay = this.config.retryDelay * attempt;
          console.log(`🔄 Retrying in ${delay}ms...`);
          await this.sleep(delay);
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

    console.error(`💥 Final error for ${locationData.location}: ${errorMessage}`);
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

    console.log('🔍 AusPost Labels API Configuration Validation:');
    console.log(`   Base URL: ${this.config.baseUrl || 'NOT SET'}`);
    console.log(`   Endpoint: ${this.config.endpoint?.url || 'NOT SET'}`);
    console.log(`   Valid: ${issues.length === 0 ? 'YES' : 'NO'}`);
    if (issues.length > 0) {
      console.log(`   Issues: ${issues.join(', ')}`);
    }

    return {
      valid: issues.length === 0,
      issues: issues
    };
  }
}

module.exports = AuspostLabelsApiService;
