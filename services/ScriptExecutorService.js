const QueryBuilder = require('../utils/QueryBuilder');
const DateHelper = require('../utils/DateHelper');

class ScriptExecutorService {
  constructor(connection) {
    this.connection = connection;
  }

  async executeScript(scriptKey, scriptConfig, requestParams = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`Executing script: ${scriptKey} with params:`, requestParams);
      
      // Build dynamic query with parameters
      const { query, params } = QueryBuilder.buildDynamicQuery(scriptConfig.scriptModule.query, requestParams, scriptKey);

      // Execute SQL query with parameters
      const [rawResults] = await this.connection.execute(query, params);
      console.log(`Raw results count for ${scriptKey}:`, rawResults.length);
      
      // Apply data transformation if exists
      let transformedData = rawResults;
      let skippedCount = 0;
      let processedOrderNumbers = [];
      let locationSummary = {};
      
      if (scriptConfig.scriptModule.transform && typeof scriptConfig.scriptModule.transform === 'function') {
        // Pass delivery date to transform for gopeople and auspost scripts
        if (scriptKey === 'gopeople') {
          transformedData = scriptConfig.scriptModule.transform(rawResults, requestParams.date);
          skippedCount = rawResults.length - transformedData.length;
          if (skippedCount > 0) {
            console.log(`GoPeople: ${skippedCount} orders skipped due to cutoff times`);
          }
        } else if (scriptKey === 'auspost') {
          transformedData = scriptConfig.scriptModule.transform(rawResults, requestParams.date);
          skippedCount = rawResults.length - transformedData.length;
          if (skippedCount > 0) {
            console.log(`Auspost: ${skippedCount} orders skipped due to cutoff times`);
          }
        } else if (scriptKey === 'personalized') {
          // Handle personalized script's dual return
          const personalizedResult = scriptConfig.scriptModule.transform(rawResults);
          transformedData = personalizedResult.transformedData;
          processedOrderNumbers = personalizedResult.processedOrderNumbers;
          console.log(`Personalized: ${processedOrderNumbers.length} orders actually processed`);
        } else if (scriptKey === 'packing_message') {
          // Handle packing_message script's dual return with final batch numbers
          const packingMessageResult = scriptConfig.scriptModule.transform(rawResults, requestParams.finalBatchNumbers);
          transformedData = packingMessageResult.transformedData;
          processedOrderNumbers = packingMessageResult.processedOrderNumbers;
          console.log(`Packing-Message: ${processedOrderNumbers.length} orders actually processed`);
        } else if (scriptKey === 'fos_update') {
          // Handle FOS_update script
          const fosResult = scriptConfig.scriptModule.transform(rawResults, requestParams.orderNumbers);
          transformedData = fosResult.updateResult;
          processedOrderNumbers = fosResult.processedOrderNumbers;
          console.log(`FOS_update: ${processedOrderNumbers.length} orders successfully updated`);
        } else if (scriptKey === 'orders') {
          // Handle orders script with dual return (existing transform + location summary)
          const ordersResult = scriptConfig.scriptModule.transform(rawResults);
          transformedData = ordersResult;
          
          // Generate location summary
          locationSummary = rawResults.reduce((summary, row) => {
            const location = row.location_name;
            if (location) {
              summary[location] = (summary[location] || 0) + 1;
            }
            return summary;
          }, {});
          
          console.log(`Orders: Generated location summary:`, locationSummary);
        } else {
          transformedData = scriptConfig.scriptModule.transform(rawResults);
        }
        console.log(`Transformed data count for ${scriptKey}:`, Array.isArray(transformedData) ? transformedData.length : 1);
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        scriptKey,
        name: scriptConfig.name,
        success: true,
        recordCount: rawResults.length,
        transformedRecordCount: Array.isArray(transformedData) ? transformedData.length : 1,
        skippedCount: skippedCount,
        executionTime,
        timestamp: new Date().toISOString(),
        appliedParams: {
          date: requestParams.date ? DateHelper.formatDate(requestParams.date) : null,
          location: requestParams.location || null,
          orderNumbers: requestParams.orderNumbers ? requestParams.orderNumbers.length : 0
        },
        data: transformedData,
        processedOrderNumbers: processedOrderNumbers,
        locationSummary: locationSummary
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`Script ${scriptKey} failed:`, error);
      
      return {
        scriptKey,
        name: scriptConfig.name,
        success: false,
        error: error.message,
        executionTime,
        timestamp: new Date().toISOString(),
        appliedParams: requestParams,
        data: null,
        processedOrderNumbers: [],
        locationSummary: {}
      };
    }
  }
}

module.exports = ScriptExecutorService;