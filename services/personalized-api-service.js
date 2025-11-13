const axios = require('axios');
const { PERSONALIZED_API_CONFIG, getTemplateConfig } = require('../config');

class PersonalizedApiService {
  constructor() {
    this.config = PERSONALIZED_API_CONFIG;
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async processPersonalizedPackingNotes(personalizedData) {
    const results = {
      success: true,
      processedEndpoints: [],
      errors: [],
      fieldValidation: {
        totalEntries: 0,
        validEntries: 0,
        entriesWithMissingFields: 0,
        fieldIssues: []
      },
      summary: {
        totalProcessed: 0,
        successfulCalls: 0,
        failedCalls: 0
      }
    };

    try {
      let parsedData;
      try {
        parsedData = typeof personalizedData === 'string'
          ? JSON.parse(personalizedData)
          : personalizedData;
      } catch (parseError) {
        throw new Error(`Failed to parse personalized data: ${parseError.message}`);
      }

      // Add comprehensive logging for debugging
      console.log('=== PersonalizedApiService Debug Info ===');
      console.log('Received data type:', typeof parsedData);
      console.log('Is array:', Array.isArray(parsedData));
      console.log('Data length/keys:', Array.isArray(parsedData) ? parsedData.length : Object.keys(parsedData));

      if (Array.isArray(parsedData) && parsedData.length > 0) {
        console.log('Sample entry structure:', JSON.stringify(parsedData[0], null, 2));
      } else if (typeof parsedData === 'object') {
        console.log('Object keys:', Object.keys(parsedData));
        console.log('Sample object structure:', JSON.stringify(parsedData, null, 2));
      }

      // Validate and complete field requirements for all entries
      const validationResults = this.validateAndCompleteFields(parsedData);
      results.fieldValidation = validationResults;

      // Process each entry with content-based routing
      if (Array.isArray(parsedData)) {
        console.log(`\n=== Content-Based Routing Processing ===`);
        console.log(`Processing ${parsedData.length} entries with content analysis`);

        for (let index = 0; index < parsedData.length; index++) {
          const entry = parsedData[index];
          console.log(`\n--- Processing entry ${index + 1}/${parsedData.length} ---`);

          let parsedEntry;
          try {
            parsedEntry = typeof entry === 'string' ? JSON.parse(entry) : entry;
            console.log('Entry keys:', Object.keys(parsedEntry));
          } catch (error) {
            console.error(`Failed to parse entry ${index}:`, error.message);
            continue;
          }

          // Analyze content to determine which APIs to call
          const targetEndpoints = this.analyzeContentForRouting(parsedEntry);

          if (targetEndpoints.length === 0) {
            console.log(`⚠️  No matching keywords found in entry ${index}, skipping`);
            continue;
          }

          // Send this entry to each determined API endpoint
          for (const endpointKey of targetEndpoints) {
            console.log(`\n📤 Sending entry ${index + 1} to ${endpointKey} API`);
            if (endpointKey === 'message_cards') {
              console.log(`🎯 DEBUG: About to call message_cards API!`);
              console.log(`   Entry location: ${parsedEntry.location}`);
              console.log(`   Message cards data present: ${parsedEntry.message_cards_data !== undefined}`);
            }
            results.summary.totalProcessed++;

            try {
              const apiResult = await this.callPersonalizedApi(endpointKey, parsedEntry);
              console.log(`✅ API call successful for entry ${index + 1} → ${endpointKey}`);

              results.processedEndpoints.push({
                entryIndex: index + 1,
                endpoint: endpointKey,
                success: true,
                entryObject: parsedEntry,
                response: apiResult
              });
              results.summary.successfulCalls++;
            } catch (error) {
              console.error(`❌ API call failed for entry ${index + 1} → ${endpointKey}:`, error.message);

              results.processedEndpoints.push({
                entryIndex: index + 1,
                endpoint: endpointKey,
                success: false,
                entryObject: parsedEntry,
                error: error.message
              });
              results.errors.push(`Entry ${index + 1} → ${endpointKey}: ${error.message}`);
              results.summary.failedCalls++;
            }
          }
        }
      } else {
        console.log('⚠️  Expected array format but received object, skipping processing');
        results.errors.push('Expected array format for personalized_packingslip_notes but received object');
      }

      console.log('\n=== Processing Summary ===');
      console.log(`Total data types processed: ${results.summary.totalProcessed}`);
      console.log(`Successful API calls: ${results.summary.successfulCalls}`);
      console.log(`Failed API calls: ${results.summary.failedCalls}`);

      if (results.summary.failedCalls > 0) {
        results.success = false;
      }

      return results;

    } catch (error) {
      return {
        success: false,
        processedEndpoints: [],
        errors: [`Service initialization error: ${error.message}`],
        summary: {
          totalProcessed: 0,
          successfulCalls: 0,
          failedCalls: 0
        }
      };
    }
  }

  async callPersonalizedApi(endpointKey, entryObject) {
    console.log(`\n🔄 Making API call for endpoint: ${endpointKey}`);
    console.log(`🎯 DEBUG: callPersonalizedApi called with endpointKey='${endpointKey}'`);

    // Get location from entry object
    const location = entryObject.location;

    if (!location) {
      console.error(`❌ No location found in entry object`);
      throw new Error('No location found in entry object');
    }

    // Get dynamic endpoint based on location and template type
    const templateConfig = getTemplateConfig(location, endpointKey);
    const endpointUrl = templateConfig.endpoint;

    if (!endpointUrl) {
      console.error(`❌ Unknown endpoint: ${endpointKey} for location: ${location}`);
      throw new Error(`Unknown endpoint: ${endpointKey} for location: ${location}`);
    }

    console.log(`📡 Using template version '${templateConfig.version}' for ${location}`);
    console.log(`📡 Making API call to: POST ${this.config.baseUrl}${endpointUrl}`);
    if (endpointKey === 'message_cards') {
      console.log(`🎯 DEBUG: MESSAGE CARDS API CALL STARTING`);
      console.log(`   Full URL: ${this.config.baseUrl}${endpointUrl}`);
      console.log(`   Location: ${location}`);
    }

    let lastError;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${this.config.retryAttempts} for ${endpointKey}`);

      try {
        const response = await this.axiosInstance({
          method: 'POST',
          url: endpointUrl,
          data: entryObject  // Send entry object directly without wrapper
        });

        console.log(`✅ API call successful for ${endpointKey} - Status: ${response.status}`);

        return {
          statusCode: response.status,
          data: response.data,
          attempt: attempt,
          entryObject: entryObject
        };

      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed for ${endpointKey}:`, error.message);

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

    console.error(`💥 Final error for ${endpointKey}: ${errorMessage}`);
    throw new Error(`API call failed after ${this.config.retryAttempts} attempts: ${errorMessage}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  analyzeContentForRouting(entryObject) {
    console.log(`\n🔍 Analyzing entry content for routing...`);
    console.log(`🎯 DEBUG: Entry keys:`, Object.keys(entryObject));

    const keywordMap = {
      'candles_plants_data': 'candles',
      'jars_luxe_data': 'jars_luxe',
      'jars_classic_large_data': 'jars_classic_large',
      'prosecco_data': 'prosecco',
      'bauble_data': 'bauble',
      'packing_slips_data': 'packing_slips',
      'message_cards_data': 'message_cards',
    };

    const foundEndpoints = new Set();
    const entryText = JSON.stringify(entryObject).toLowerCase();

    console.log(`📝 Entry text to analyze: ${entryText.substring(0, 200)}...`);
    console.log(`🎯 DEBUG: Checking for message_cards_data...`);
    console.log(`   - Direct property check: entryObject.message_cards_data exists = ${entryObject.message_cards_data !== undefined}`);
    console.log(`   - String includes check: entryText.includes('message_cards_data') = ${entryText.includes('message_cards_data')}`);

    Object.entries(keywordMap).forEach(([keyword, endpoint]) => {
      if (entryText.includes(keyword)) {
        foundEndpoints.add(endpoint);
        console.log(`✅ Found keyword '${keyword}' → routing to ${endpoint} endpoint`);
      } else {
        console.log(`   ❌ Keyword '${keyword}' not found`);
      }
    });

    const endpointsArray = Array.from(foundEndpoints);
    console.log(`🎯 Final routing decision: ${endpointsArray.length} endpoints - [${endpointsArray.join(', ')}]`);

    return endpointsArray;
  }

  validateAndCompleteFields(data) {
    const validation = {
      totalEntries: 0,
      validEntries: 0,
      entriesWithMissingFields: 0,
      fieldIssues: []
    };

    const requiredFields = ['location', 'batch', 'delivery_date'];
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    // If data is an array (from personalized_packingslip_notes)
    if (Array.isArray(data)) {
      data.forEach((entry, index) => {
        validation.totalEntries++;
        let parsedEntry;

        try {
          parsedEntry = typeof entry === 'string' ? JSON.parse(entry) : entry;
        } catch (error) {
          validation.fieldIssues.push({
            entryIndex: index,
            type: 'parse_error',
            message: 'Failed to parse entry as JSON',
            entry: entry
          });
          validation.entriesWithMissingFields++;
          return;
        }

        const missingFields = [];
        const fieldIssues = [];

        requiredFields.forEach(field => {
          if (!parsedEntry[field]) {
            missingFields.push(field);
          }
        });

        // Validate delivery_date format if present
        if (parsedEntry.delivery_date && !datePattern.test(parsedEntry.delivery_date)) {
          fieldIssues.push({
            field: 'delivery_date',
            value: parsedEntry.delivery_date,
            issue: 'Invalid format, expected yyyy-mm-dd'
          });
        }

        if (missingFields.length > 0 || fieldIssues.length > 0) {
          validation.entriesWithMissingFields++;
          validation.fieldIssues.push({
            entryIndex: index,
            type: 'field_validation',
            missingFields: missingFields,
            fieldIssues: fieldIssues,
            entry: parsedEntry
          });
        } else {
          validation.validEntries++;
        }
      });
    } else {
      // Handle object format (individual data type entries)
      const dataTypes = ['jars_luxe_data', 'jars_classic_large_data', 'prosecco_data', 'bauble_data', 'packing_slips_data', 'message_cards_data', 'candles_data'];

      dataTypes.forEach(dataType => {
        if (data[dataType] && Array.isArray(data[dataType])) {
          data[dataType].forEach((entry, index) => {
            validation.totalEntries++;
            const missingFields = [];
            const fieldIssues = [];

            requiredFields.forEach(field => {
              if (!entry[field]) {
                missingFields.push(field);
              }
            });

            // Validate delivery_date format if present
            if (entry.delivery_date && !datePattern.test(entry.delivery_date)) {
              fieldIssues.push({
                field: 'delivery_date',
                value: entry.delivery_date,
                issue: 'Invalid format, expected yyyy-mm-dd'
              });
            }

            if (missingFields.length > 0 || fieldIssues.length > 0) {
              validation.entriesWithMissingFields++;
              validation.fieldIssues.push({
                dataType: dataType,
                entryIndex: index,
                type: 'field_validation',
                missingFields: missingFields,
                fieldIssues: fieldIssues,
                entry: entry
              });
            } else {
              validation.validEntries++;
            }
          });
        }
      });
    }

    console.log(`Field validation complete: ${validation.validEntries}/${validation.totalEntries} entries valid, ${validation.entriesWithMissingFields} entries with issues`);

    if (validation.fieldIssues.length > 0) {
      console.log('Field validation issues found:', validation.fieldIssues.slice(0, 5)); // Log first 5 issues
    }

    return validation;
  }

  validateConfiguration() {
    const issues = [];

    if (!this.config.baseUrl) {
      issues.push('Missing base URL configuration');
    }

    // Note: Endpoint validation removed - Personalized API uses location-specific endpoints
    // retrieved via getTemplateConfig(location, templateType)
    // Templates: jars_luxe, jars_classic_large, prosecco, packing_slips, message_cards, candles

    return {
      valid: issues.length === 0,
      issues: issues
    };
  }
}

module.exports = PersonalizedApiService;