const QueryBuilder = require('../utils/QueryBuilder');
const DateHelper = require('../utils/DateHelper');

class ScriptExecutorService {
  constructor(connection) {
    this.connection = connection;
  }

  async executeFosUpdateDual(scriptConfig, successfulOrderIds, successfulOrderNumbers, unsuccessfulOrderIds, unsuccessfulOrderNumbers) {
    const startTime = Date.now();
    const scriptKey = 'fos_update';
    const results = {
      successful: { affectedRows: 0, processedOrderNumbers: [] },
      unsuccessful: { affectedRows: 0, processedOrderNumbers: [] }
    };

    try {
      console.log(`\n🔄 === DUAL FOS UPDATE EXECUTION ===`);
      console.log(`Successful orders: ${successfulOrderIds.length}, Unsuccessful orders: ${unsuccessfulOrderIds.length}`);

      // Execute successful orders update
      if (successfulOrderIds.length > 0) {
        console.log(`\n📝 Executing FOS update for SUCCESSFUL orders (→ 'Processed')...`);
        const successfulParams = { successfulOrderIds, orderNumbers: successfulOrderNumbers };
        const { query: successfulQuery, params: successfulQueryParams } = QueryBuilder.buildDynamicQuery(
          scriptConfig.scriptModule.querySuccessful,
          successfulParams,
          scriptKey
        );

        console.log(`Successful query:`, successfulQuery);
        console.log(`Query parameters:`, successfulQueryParams);

        const [successfulRawResults] = await this.connection.execute(successfulQuery, successfulQueryParams);
        const successfulTransformed = scriptConfig.scriptModule.transform(successfulRawResults, successfulOrderNumbers, true);

        results.successful.affectedRows = successfulTransformed.affectedRows || 0;
        results.successful.processedOrderNumbers = successfulTransformed.processedOrderNumbers || [];
        results.successful.updateResult = successfulTransformed.updateResult;
      } else {
        console.log(`⏭️  Skipping successful orders update (0 orders)`);
      }

      // Execute unsuccessful orders update
      if (unsuccessfulOrderIds.length > 0) {
        console.log(`\n📝 Executing FOS update for UNSUCCESSFUL orders (→ 'Hold')...`);
        const unsuccessfulParams = { unsuccessfulOrderIds, orderNumbers: unsuccessfulOrderNumbers };
        const { query: unsuccessfulQuery, params: unsuccessfulQueryParams } = QueryBuilder.buildDynamicQuery(
          scriptConfig.scriptModule.queryUnsuccessful,
          unsuccessfulParams,
          scriptKey
        );

        console.log(`Unsuccessful query:`, unsuccessfulQuery);
        console.log(`Query parameters:`, unsuccessfulQueryParams);

        const [unsuccessfulRawResults] = await this.connection.execute(unsuccessfulQuery, unsuccessfulQueryParams);
        const unsuccessfulTransformed = scriptConfig.scriptModule.transform(unsuccessfulRawResults, unsuccessfulOrderNumbers, false);

        results.unsuccessful.affectedRows = unsuccessfulTransformed.affectedRows || 0;
        results.unsuccessful.processedOrderNumbers = unsuccessfulTransformed.processedOrderNumbers || [];
        results.unsuccessful.updateResult = unsuccessfulTransformed.updateResult;
      } else {
        console.log(`⏭️  Skipping unsuccessful orders update (0 orders)`);
      }

      const executionTime = Date.now() - startTime;
      console.log(`\n✅ FOS Update completed:`);
      console.log(`  - Successful orders affected: ${results.successful.affectedRows}`);
      console.log(`  - Unsuccessful orders affected: ${results.unsuccessful.affectedRows}`);
      console.log(`  - Total execution time: ${executionTime}ms`);
      console.log(`=== END DUAL FOS UPDATE EXECUTION ===\n`);

      // Combine processed order numbers
      const allProcessedOrderNumbers = [
        ...results.successful.processedOrderNumbers,
        ...results.unsuccessful.processedOrderNumbers
      ];

      return {
        scriptKey,
        name: scriptConfig.name,
        success: true,
        recordCount: results.successful.affectedRows + results.unsuccessful.affectedRows,
        executionTime,
        timestamp: new Date().toISOString(),
        appliedParams: {
          successfulOrders: successfulOrderIds.length,
          unsuccessfulOrders: unsuccessfulOrderIds.length
        },
        data: results,
        processedOrderNumbers: allProcessedOrderNumbers
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`Dual FOS_update failed:`, error);

      return {
        scriptKey,
        name: scriptConfig.name,
        success: false,
        error: error.message,
        executionTime,
        timestamp: new Date().toISOString(),
        appliedParams: {
          successfulOrders: successfulOrderIds.length,
          unsuccessfulOrders: unsuccessfulOrderIds.length
        },
        data: null,
        processedOrderNumbers: []
      };
    }
  }

  async executeScript(scriptKey, scriptConfig, requestParams = {}) {
    const startTime = Date.now();

    try {
      console.log(`Executing script: ${scriptKey} with params:`, requestParams);

      // Build dynamic query with parameters
      const { query, params } = QueryBuilder.buildDynamicQuery(scriptConfig.scriptModule.query, requestParams, scriptKey);

      // Log the final SQL query for orders script
      if (scriptKey === 'orders') {
        console.log(`\n📋 === ORDERS SCRIPT SQL QUERY ===`);
        console.log(query);
        console.log(`Query Parameters:`, params);
        console.log(`=== END ORDERS SCRIPT SQL QUERY ===\n`);
      }

      // Log the final SQL query for gopeople script
      if (scriptKey === 'gopeople') {
        console.log(`\n🚚 === GOPEOPLE SCRIPT SQL QUERY ===`);
        console.log(query);
        console.log(`Query Parameters:`, params);
        console.log(`Number of orders being queried: ${params.length}`);
        console.log(`=== END GOPEOPLE SCRIPT SQL QUERY ===\n`);
      }

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
          const manualTimeframe = requestParams.manualTimeframe || null;
          transformedData = scriptConfig.scriptModule.transform(rawResults, requestParams.date, manualTimeframe);
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