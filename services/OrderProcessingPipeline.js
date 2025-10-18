const mysql = require('mysql2/promise');
const BatchManagementService = require('./BatchManagementService');
const ScriptExecutorService = require('./ScriptExecutorService');
const GoPeopleApiService = require('./GoPeopleApiService');
const AuspostApiService = require('./AuspostApiService');
const PersonalizedApiService = require('./personalized-api-service');
const GpLabelsApiService = require('./gp-labels-api-service');
const AuspostLabelsApiService = require('./auspost-labels-api-service');
const AuspostLabelsDownloadService = require('./AuspostLabelsDownloadService');
const ProductTallyService = require('./ProductTallyService');
const GoogleDriveService = require('../gdrive-service');
const GoogleSheetsService = require('./GoogleSheetsService');
const EmailService = require('./EmailService');
const DateHelper = require('../utils/DateHelper');
const ResponseFormatter = require('../utils/ResponseFormatter');

class OrderProcessingPipeline {
  constructor(requestParams, dbConfig, gopeopleConfig, auspostConfig, scriptsConfig) {
    this.requestParams = requestParams;
    this.dbConfig = dbConfig;
    this.gopeopleConfig = gopeopleConfig;
    this.auspostConfig = auspostConfig;
    this.SCRIPTS_CONFIG = scriptsConfig;
    this.batchService = new BatchManagementService();
    this.gopeopleService = new GoPeopleApiService(gopeopleConfig.token, gopeopleConfig.url);
    this.auspostService = new AuspostApiService(
      auspostConfig.lvly,
      auspostConfig.bloomeroo
    );
    this.personalizedApiService = new PersonalizedApiService();
    this.gpLabelsApiService = new GpLabelsApiService();
    this.auspostLabelsApiService = new AuspostLabelsApiService();
    this.auspostLabelsDownloadService = new AuspostLabelsDownloadService();
    this.productTallyService = new ProductTallyService();
    this.googleSheetsService = new GoogleSheetsService();
    this.emailService = new EmailService();
  }

  async execute() {
    const overallStartTime = Date.now();
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const isManualMode = this.requestParams.isManualProcessing === true;
    let connection;

    try {
      console.log('\n' + '='.repeat(80));
      console.log(`🚀 NEW REQUEST STARTED - ID: ${requestId}`);
      console.log(`Processing Mode: ${isManualMode ? '🔧 MANUAL' : '🤖 AUTOMATIC'}`);
      console.log('='.repeat(80));
      console.log('Request parameters:', this.requestParams);
      
      // Parse dev_mode flags (6-digit format: gopeople, personalized_api, gp_labels_api, product_tally, fos_update, google_sheets)
      console.log(`\n🔍 === DEV MODE PARSING DEBUG ===`);
      console.log(`Raw dev_mode parameter:`, this.requestParams.dev_mode);
      console.log(`Type of dev_mode:`, typeof this.requestParams.dev_mode);
      console.log(`Length of dev_mode:`, this.requestParams.dev_mode?.length);

      if (this.requestParams.dev_mode) {
        console.log(`Character breakdown:`);
        for (let i = 0; i < this.requestParams.dev_mode.length; i++) {
          console.log(`  dev_mode[${i}]: "${this.requestParams.dev_mode[i]}" (${typeof this.requestParams.dev_mode[i]})`);
        }
      }

      const executeGoPeopleApiCalls_flag = this.requestParams.dev_mode[0] === '1';
      const executePersonalizedApiCalls_flag = this.requestParams.dev_mode[1] === '1';
      const executeGpLabelsApiCalls_flag = this.requestParams.dev_mode[2] === '1';
      const executeProductTallyApiCalls_flag = this.requestParams.dev_mode[3] === '1';
      const executeFosUpdate_flag = this.requestParams.dev_mode[4] === '1';
      const executeGoogleSheetsWrite_flag = this.requestParams.dev_mode[5] === '1';

      console.log(`\nFlag assignments:`);
      console.log(`  dev_mode[0] = "${this.requestParams.dev_mode[0]}" → executeGoPeopleApiCalls_flag: ${executeGoPeopleApiCalls_flag}`);
      console.log(`  dev_mode[1] = "${this.requestParams.dev_mode[1]}" → executePersonalizedApiCalls_flag: ${executePersonalizedApiCalls_flag}`);
      console.log(`  dev_mode[2] = "${this.requestParams.dev_mode[2]}" → executeGpLabelsApiCalls_flag: ${executeGpLabelsApiCalls_flag}`);
      console.log(`  dev_mode[3] = "${this.requestParams.dev_mode[3]}" → executeProductTallyApiCalls_flag: ${executeProductTallyApiCalls_flag}`);
      console.log(`  dev_mode[4] = "${this.requestParams.dev_mode[4]}" → executeFosUpdate_flag: ${executeFosUpdate_flag}`);
      console.log(`  dev_mode[5] = "${this.requestParams.dev_mode[5]}" → executeGoogleSheetsWrite_flag: ${executeGoogleSheetsWrite_flag}`);
      console.log(`=== END DEV MODE PARSING DEBUG ===\n`);

      console.log(`Dev mode flags - GoPeople API: ${executeGoPeopleApiCalls_flag}, Personalized API: ${executePersonalizedApiCalls_flag}, GP Labels API: ${executeGpLabelsApiCalls_flag}, Product Tally: ${executeProductTallyApiCalls_flag}, FOS Update: ${executeFosUpdate_flag}, Google Sheets: ${executeGoogleSheetsWrite_flag}`);
      
      // Format delivery date for batch management
      const deliveryDate = DateHelper.formatDate(this.requestParams.date);
      console.log(`Batch Management: Using delivery date: ${deliveryDate}`);
      
      // Step 0: Get current batch numbers from Firestore
      console.log(`\n[${requestId}] ━━━ STAGE 0: BATCH INITIALIZATION ━━━`);
      console.log('Batch Management: Fetching current batch numbers...');
      const currentBatchNumbers = await this.batchService.getBatchNumbers(deliveryDate, this.requestParams.is_same_day);
      
      console.log('Starting database connection...');
      connection = await mysql.createConnection(this.dbConfig);
      const scriptExecutor = new ScriptExecutorService(connection);

      // Initialize tracking variables
      const results = {};
      const executionDetails = {};
      let successCount = 0;
      let failureCount = 0;
      let orderTrackingArray = [];
      let finalBatchNumbers = { ...currentBatchNumbers };
      let folderPreCreationResults = null;
      
      // Step 1: Execute orders script first
      console.log(`\n[${requestId}] ━━━ STAGE 1: ORDERS SCRIPT ━━━`);
      console.log('Executing orders script...');
      const ordersResult = await scriptExecutor.executeScript('orders', this.SCRIPTS_CONFIG.orders, this.requestParams);
      
      results['orders'] = ordersResult.data;
      const { data: ordersData, processedOrderNumbers: ordersProcessedOrderNumbers, locationSummary, scriptKey: ordersScriptKey, ...ordersExecutionInfo } = ordersResult;
      executionDetails['orders'] = ordersExecutionInfo;
      
      if (ordersResult.success) {
        successCount++;
        
        // Step 1.5: Update batch numbers based on location summary
        // console.log('Batch Management: Updating batch numbers based on order counts...');
        // finalBatchNumbers = await this.batchService.updateBatchNumbers(deliveryDate, locationSummary, currentBatchNumbers);
        
        // Initialize tracking array with order IDs, order numbers, delivery date, locations, and batch numbers
        if (ordersResult.data && Array.isArray(ordersResult.data) && ordersResult.data.length > 0) {
          orderTrackingArray = ordersResult.data.map(orderData => ({
            id: orderData.id,  // Add unique database ID
            store: orderData.shop_id === 10 ? 'LVLY' : orderData.shop_id === 6 ? 'BL' : '',
            order_number: orderData.order_number,
            delivery_date: deliveryDate,
            location: orderData.location,
            is_same_day: this.requestParams.is_same_day === '1' ? 'Same_day' : 'Next_day',
            batch: finalBatchNumbers[orderData.location],
            gopeople_status: false,
            gopeople_error: null,
            gp_pickupdate: null,
            auspost_status: false,
            auspost_error: null,
            personalized_status: false,
            packing_slip_status: false,
            message_cards_status: false,
            updateProcessingStatus: false,
            order_products: orderData.order_products || ''
          }));
          console.log(`Initialized tracking array with ${orderTrackingArray.length} orders`);
        }
      } else {
        failureCount++;
      }
      
      // Step 2: Route to logistics provider based on is_same_day parameter
      console.log(`\n[${requestId}] ━━━ STAGE 2: LOGISTICS PROVIDER ━━━`);
      console.log(`\n🚚 === LOGISTICS PROVIDER ROUTING ===`);
      console.log(`is_same_day parameter: ${this.requestParams.is_same_day} (${this.requestParams.is_same_day === '1' ? 'GoPeople' : 'Auspost'})`);

      let logisticsResults = null;

      if (this.requestParams.is_same_day === '1') {
        console.log(`✅ Routing to GoPeople`);
        console.log(`=== END LOGISTICS ROUTING ===\n`);

        const { gopeopleResults, newSuccessCount, newFailureCount } = await this.executeGoPeopleStep(
          ordersResult, executeGoPeopleApiCalls_flag, scriptExecutor, results, executionDetails, orderTrackingArray
        );
        logisticsResults = gopeopleResults;
        successCount += newSuccessCount;
        failureCount += newFailureCount;

        // Step 2.5: Update batch numbers based on successful gopeople orders
        finalBatchNumbers = await this.updateBatchNumbersAfterLogistics(orderTrackingArray, deliveryDate, currentBatchNumbers, 'gopeople', this.requestParams.is_same_day);
      } else {
        console.log(`✅ Routing to Auspost`);
        console.log(`=== END LOGISTICS ROUTING ===\n`);

        const { auspostResults, newSuccessCount, newFailureCount } = await this.executeAuspostStep(
          ordersResult, executeGoPeopleApiCalls_flag, scriptExecutor, results, executionDetails, orderTrackingArray
        );
        logisticsResults = auspostResults;
        successCount += newSuccessCount;
        failureCount += newFailureCount;

        // Step 2.5: Update batch numbers based on successful auspost orders
        finalBatchNumbers = await this.updateBatchNumbersAfterLogistics(orderTrackingArray, deliveryDate, currentBatchNumbers, 'auspost', this.requestParams.is_same_day);
      }

      // Step 2.75: Pre-create folder structure for successful logistics orders
      console.log(`\n[${requestId}] ━━━ STAGE 2.75: FOLDER PRE-CREATION ━━━`);
      folderPreCreationResults = await this.preCreateFolders(orderTrackingArray, deliveryDate, finalBatchNumbers);

      // Step 2.8: Process Labels (GP or AusPost based on is_same_day) after folder creation
      console.log(`\n[${requestId}] ━━━ STAGE 2.8: LABELS PROCESSING ━━━`);
      let labelsApiResults = null;
      if (this.requestParams.is_same_day === '1') {
        // GoPeople labels for same-day orders
        labelsApiResults = await this.executeGpLabelsStep(executeGpLabelsApiCalls_flag, logisticsResults, results, executionDetails, finalBatchNumbers);
      } else {
        // AusPost labels for non-same-day orders
        labelsApiResults = await this.executeAuspostLabelsStep(executeGpLabelsApiCalls_flag, logisticsResults, results, executionDetails, finalBatchNumbers);
      }
      
      // Step 3: Execute personalized and packing-message scripts
      console.log(`\n[${requestId}] ━━━ STAGE 3: PERSONALIZED & PACKING SCRIPTS ━━━`);
      const { personalizedResults, packingResults } = await this.executePersonalizedAndPackingSteps(
        orderTrackingArray, scriptExecutor, results, executionDetails, finalBatchNumbers, deliveryDate
      );
      successCount += personalizedResults.successCount;
      failureCount += personalizedResults.failureCount;
      
      // Step 3.5: Process polaroid images to Google Drive
      console.log(`\n[${requestId}] ━━━ STAGE 3.5: POLAROID PROCESSING ━━━`);
      const polaroidProcessingResults = await this.processPolaroidImages(results, deliveryDate, finalBatchNumbers);

      // Step 3.75: Execute Personalized API service
      console.log(`\n[${requestId}] ━━━ STAGE 3.75: PERSONALIZED API CALLS ━━━`);
      const personalizedApiResults = await this.executePersonalizedApiStep(
        executePersonalizedApiCalls_flag, results, executionDetails
      );
      successCount += personalizedApiResults.successCount;
      failureCount += personalizedApiResults.failureCount;

      // Step 3.8: Update tracking array with correct API success status
      console.log(`\n[${requestId}] ━━━ STAGE 3.8: TRACKING ARRAY UPDATE ━━━`);
      this.updateTrackingArrayWithApiResults(orderTrackingArray, personalizedApiResults);

      // Step 3.9: Execute Product Tally
      console.log(`\n[${requestId}] ━━━ STAGE 3.9: PRODUCT TALLY ━━━`);
      const productTallyResults = await this.executeProductTallyStep(
        orderTrackingArray, executeProductTallyApiCalls_flag, deliveryDate, finalBatchNumbers, results, executionDetails
      );
      successCount += productTallyResults.successCount;
      failureCount += productTallyResults.failureCount;

      // Step 4: Execute FOS_update script
      console.log(`\n[${requestId}] ━━━ STAGE 4: FOS UPDATE ━━━`);
      const fosResults = await this.executeFosUpdateStep(
        orderTrackingArray, executeFosUpdate_flag, scriptExecutor, results, executionDetails
      );
      successCount += fosResults.successCount;
      failureCount += fosResults.failureCount;

      // Step 5: Write to Google Sheets
      console.log(`\n[${requestId}] ━━━ STAGE 5: GOOGLE SHEETS WRITE ━━━`);
      const googleSheetsResults = await this.executeGoogleSheetsWriteStep(
        orderTrackingArray, executeGoogleSheetsWrite_flag, results, executionDetails
      );
      successCount += googleSheetsResults.successCount;
      failureCount += googleSheetsResults.failureCount;

      const overallExecutionTime = Date.now() - overallStartTime;

      console.log(`\n[${requestId}] ━━━ PIPELINE COMPLETE ━━━`);
      console.log(`All scripts completed. Success: ${successCount}, Failed/Skipped: ${failureCount}`);
      console.log(`Order tracking array final state:`, orderTrackingArray.length, 'orders');
      console.log('Final batch numbers used:', finalBatchNumbers);
      console.log('='.repeat(80));
      console.log(`✅ REQUEST COMPLETE - ID: ${requestId} - Duration: ${overallExecutionTime}ms`);
      console.log('='.repeat(80) + '\n');

      // Return different response format for manual processing mode
      if (isManualMode) {
        return this.formatManualResponse(orderTrackingArray, overallExecutionTime, successCount, failureCount);
      } else {
        return ResponseFormatter.formatResponse({
          success: successCount > 0,
          successCount,
          failureCount,
          overallExecutionTime,
          requestParams: this.requestParams,
          orderTrackingArray,
          deliveryDate,
          currentBatchNumbers,
          finalBatchNumbers,
          locationSummary,
          executionDetails,
          results,
          folderPreCreationResults,
          polaroidProcessingResults,
          personalizedApiResults,
          labelsApiResults,
          googleSheetsResults,
          SCRIPTS_CONFIG: this.SCRIPTS_CONFIG,
          isZapierRequest: this.requestParams.source === 'zapier'
        });
      }

    } finally {
      if (connection) {
        await connection.end();
        console.log('Database connection closed');
      }
    }
  }

  async executeGoPeopleStep(ordersResult, executeGoPeopleApiCalls_flag, scriptExecutor, results, executionDetails, orderTrackingArray) {
    let gopeopleApiResults = null;
    let successCount = 0;
    let failureCount = 0;

    if (ordersResult.success && ordersResult.data && Array.isArray(ordersResult.data) && ordersResult.data.length > 0) {
      const orderIds = ordersResult.data.map(orderData => orderData.id);
      const orderNumbers = ordersResult.data.map(orderData => orderData.order_number);
      console.log(`Orders script returned ${orderIds.length} order IDs and ${orderNumbers.length} order numbers.`);

      console.log(`\n🚀 === GOPEOPLE API EXECUTION DECISION ===`);
      console.log(`📊 executeGoPeopleApiCalls_flag: ${executeGoPeopleApiCalls_flag} (dev_mode[0] = '${this.requestParams.dev_mode[0]}')`);
      console.log(`📋 Orders available for processing: ${orderIds.length}`);

      if (executeGoPeopleApiCalls_flag) {
        console.log(`✅ Decision: EXECUTING GoPeople API calls`);
        console.log(`=== END GOPEOPLE API DECISION ===\n`);

        const extendedParams = { ...this.requestParams, orderIds: orderIds, orderNumbers: orderNumbers };

        console.log('Executing gopeople script...');
        const gopeopleResult = await scriptExecutor.executeScript('gopeople', this.SCRIPTS_CONFIG.gopeople, extendedParams);
        
        if (gopeopleResult.success) {
          if (gopeopleResult.data && gopeopleResult.data.length > 0) {
            console.log(`Making GoPeople API calls for ${gopeopleResult.data.length} orders...`);
            gopeopleApiResults = await this.gopeopleService.executeGoPeopleApiCalls(gopeopleResult.data);
            
            gopeopleApiResults.summary.skipped = gopeopleResult.skippedCount;
            gopeopleApiResults.summary.totalOrders = gopeopleResult.recordCount;
            
            results['gopeople'] = gopeopleApiResults;

            // Create a map of order numbers to pickUpDate from transformed data
            const pickupDateMap = {};
            gopeopleResult.data.forEach(transformedOrder => {
              pickupDateMap[transformedOrder.orderNumber] = transformedOrder.apiPayload.pickUpDate;
            });

            // Update tracking array with gopeople results and pickUpDate
            gopeopleApiResults.results.forEach(apiResult => {
              const trackingEntry = orderTrackingArray.find(entry => entry.order_number === apiResult.orderNumber);
              if (trackingEntry) {
                trackingEntry.gopeople_status = apiResult.success;
                trackingEntry.gopeople_error = apiResult.success ? null : apiResult.error;
                trackingEntry.gp_pickupdate = pickupDateMap[apiResult.orderNumber] || null;
              }
            });
            
            const { data: gopeopleData, processedOrderNumbers: gopeopleProcessedOrderNumbers, scriptKey: gopeopleScriptKey, ...gopeopleExecutionInfo } = gopeopleResult;
            executionDetails['gopeople'] = {
              ...gopeopleExecutionInfo,
              apiCallsSummary: gopeopleApiResults.summary,
              devModeSkipped: false
            };
            
            successCount++;
          } else if (gopeopleResult.skippedCount > 0) {
            // Handle all orders skipped due to cutoff
            this.handleAllOrdersSkipped(gopeopleResult, results, executionDetails, orderTrackingArray);
            successCount++;
          } else {
            this.handleGoPeopleFailure(gopeopleResult, results, executionDetails, orderTrackingArray, 'No data returned');
            failureCount++;
          }
        } else {
          this.handleGoPeopleFailure(gopeopleResult, results, executionDetails, orderTrackingArray, 'GoPeople script failed');
          failureCount++;
        }
      } else {
        console.log(`❌ Decision: SKIPPING GoPeople API calls (dev_mode flag disabled)`);
        console.log(`=== END GOPEOPLE API DECISION ===\n`);
        this.handleGoPeopleSkipped(results, executionDetails, orderTrackingArray, 'Skipped due to dev_mode flag');
        failureCount++;
      }
    } else {
      this.handleGoPeopleSkipped(results, executionDetails, orderTrackingArray, 'No orders found to process');
      failureCount++;
    }
    
    return { gopeopleResults: gopeopleApiResults, newSuccessCount: successCount, newFailureCount: failureCount };
  }

  async executeAuspostStep(ordersResult, executeAuspostApiCalls_flag, scriptExecutor, results, executionDetails, orderTrackingArray) {
    let auspostApiResults = null;
    let successCount = 0;
    let failureCount = 0;

    if (ordersResult.success && ordersResult.data && Array.isArray(ordersResult.data) && ordersResult.data.length > 0) {
      const orderIds = ordersResult.data.map(orderData => orderData.id);
      const orderNumbers = ordersResult.data.map(orderData => orderData.order_number);
      console.log(`Orders script returned ${orderIds.length} order IDs and ${orderNumbers.length} order numbers for Auspost.`);

      console.log(`\n📮 === AUSPOST API EXECUTION DECISION ===`);
      console.log(`📊 executeAuspostApiCalls_flag: ${executeAuspostApiCalls_flag} (dev_mode[0] = '${this.requestParams.dev_mode[0]}')`);
      console.log(`📋 Orders available for processing: ${orderIds.length}`);

      if (executeAuspostApiCalls_flag) {
        console.log(`✅ Decision: EXECUTING Auspost API calls`);
        console.log(`=== END AUSPOST API DECISION ===\n`);

        const extendedParams = { ...this.requestParams, orderIds: orderIds, orderNumbers: orderNumbers };

        console.log('Executing auspost script...');
        const auspostResult = await scriptExecutor.executeScript('auspost', this.SCRIPTS_CONFIG.auspost, extendedParams);

        if (auspostResult.success) {
          if (auspostResult.data && auspostResult.data.length > 0) {
            console.log(`Making Auspost API calls for ${auspostResult.data.length} orders...`);
            auspostApiResults = await this.auspostService.executeAuspostApiCalls(auspostResult.data);

            auspostApiResults.summary.skipped = auspostResult.skippedCount;
            auspostApiResults.summary.totalOrders = auspostResult.recordCount;

            results['auspost'] = auspostApiResults;

            // Update tracking array with auspost results
            auspostApiResults.results.forEach(apiResult => {
              const trackingEntry = orderTrackingArray.find(entry => entry.order_number === apiResult.orderNumber);
              if (trackingEntry) {
                trackingEntry.auspost_status = apiResult.success;
                trackingEntry.auspost_error = apiResult.success ? null : apiResult.error;
              }
            });

            const { data: auspostData, processedOrderNumbers: auspostProcessedOrderNumbers, scriptKey: auspostScriptKey, ...auspostExecutionInfo } = auspostResult;
            executionDetails['auspost'] = {
              ...auspostExecutionInfo,
              apiCallsSummary: auspostApiResults.summary,
              devModeSkipped: false
            };

            successCount++;
          } else if (auspostResult.skippedCount > 0) {
            // Handle all orders skipped due to cutoff
            this.handleAllOrdersSkippedAuspost(auspostResult, results, executionDetails, orderTrackingArray);
            successCount++;
          } else {
            this.handleAuspostFailure(auspostResult, results, executionDetails, orderTrackingArray, 'No data returned');
            failureCount++;
          }
        } else {
          this.handleAuspostFailure(auspostResult, results, executionDetails, orderTrackingArray, 'Auspost script failed');
          failureCount++;
        }
      } else {
        console.log(`❌ Decision: SKIPPING Auspost API calls (dev_mode flag disabled)`);
        console.log(`=== END AUSPOST API DECISION ===\n`);
        this.handleAuspostSkipped(results, executionDetails, orderTrackingArray, 'Skipped due to dev_mode flag');
        failureCount++;
      }
    } else {
      this.handleAuspostSkipped(results, executionDetails, orderTrackingArray, 'No orders found to process');
      failureCount++;
    }

    return { auspostResults: auspostApiResults, newSuccessCount: successCount, newFailureCount: failureCount };
  }

  handleAllOrdersSkipped(gopeopleResult, results, executionDetails, orderTrackingArray) {
    console.log(`All ${gopeopleResult.skippedCount} orders were past cutoff time. No API calls made.`);
    
    results['gopeople'] = {
      results: [],
      summary: {
        total: 0,
        successful: 0,
        failed: 0,
        processed: 0,
        skipped: gopeopleResult.skippedCount,
        totalOrders: gopeopleResult.recordCount,
        message: 'All orders past cutoff time'
      }
    };
    
    const { data: gopeopleData, processedOrderNumbers: gopeopleProcessedOrderNumbers, scriptKey: gopeopleScriptKey, ...gopeopleExecutionInfo } = gopeopleResult;
    executionDetails['gopeople'] = {
      ...gopeopleExecutionInfo,
      apiCallsSummary: {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: gopeopleResult.skippedCount,
        message: 'All orders past cutoff time'
      }
    };
    
    orderTrackingArray.forEach(entry => {
      entry.gopeople_error = 'Order past cutoff time';
    });
  }

  handleGoPeopleFailure(gopeopleResult, results, executionDetails, orderTrackingArray, errorMessage) {
    results['gopeople'] = null;
    
    const { data: gopeopleData, processedOrderNumbers: gopeopleProcessedOrderNumbers, scriptKey: gopeopleScriptKey, ...gopeopleExecutionInfo } = gopeopleResult;
    executionDetails['gopeople'] = gopeopleExecutionInfo;
    
    orderTrackingArray.forEach(entry => {
      entry.gopeople_error = errorMessage;
    });
  }

  handleGoPeopleSkipped(results, executionDetails, orderTrackingArray, reason) {
    console.log(`Dev mode: Skipping GoPeople script execution entirely`);

    results['gopeople'] = null;
    executionDetails['gopeople'] = {
      scriptKey: 'gopeople',
      name: 'GoPeople Logistics API',
      success: false,
      skipped: true,
      reason: reason,
      devModeSkipped: true,
      executionTime: 0,
      timestamp: new Date().toISOString(),
      appliedParams: this.requestParams
    };

    orderTrackingArray.forEach(entry => {
      entry.gopeople_error = reason;
    });
  }

  handleAllOrdersSkippedAuspost(auspostResult, results, executionDetails, orderTrackingArray) {
    console.log(`All ${auspostResult.skippedCount} Auspost orders were past cutoff time. No API calls made.`);

    results['auspost'] = {
      results: [],
      summary: {
        total: 0,
        successful: 0,
        failed: 0,
        processed: 0,
        skipped: auspostResult.skippedCount,
        totalOrders: auspostResult.recordCount,
        message: 'All orders past cutoff time'
      }
    };

    const { data: auspostData, processedOrderNumbers: auspostProcessedOrderNumbers, scriptKey: auspostScriptKey, ...auspostExecutionInfo } = auspostResult;
    executionDetails['auspost'] = {
      ...auspostExecutionInfo,
      apiCallsSummary: {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: auspostResult.skippedCount,
        message: 'All orders past cutoff time'
      }
    };

    orderTrackingArray.forEach(entry => {
      entry.auspost_error = 'Order past cutoff time';
    });
  }

  handleAuspostFailure(auspostResult, results, executionDetails, orderTrackingArray, errorMessage) {
    results['auspost'] = null;

    const { data: auspostData, processedOrderNumbers: auspostProcessedOrderNumbers, scriptKey: auspostScriptKey, ...auspostExecutionInfo } = auspostResult;
    executionDetails['auspost'] = auspostExecutionInfo;

    orderTrackingArray.forEach(entry => {
      entry.auspost_error = errorMessage;
    });
  }

  handleAuspostSkipped(results, executionDetails, orderTrackingArray, reason) {
    console.log(`Dev mode: Skipping Auspost script execution entirely`);

    results['auspost'] = null;
    executionDetails['auspost'] = {
      scriptKey: 'auspost',
      name: 'Auspost Logistics API',
      success: false,
      skipped: true,
      reason: reason,
      devModeSkipped: true,
      executionTime: 0,
      timestamp: new Date().toISOString(),
      appliedParams: this.requestParams
    };

    orderTrackingArray.forEach(entry => {
      entry.auspost_error = reason;
    });
  }

  async updateBatchNumbersAfterLogistics(orderTrackingArray, deliveryDate, currentBatchNumbers, provider = 'gopeople', isSameDay) {
    if (orderTrackingArray.length > 0) {
      const statusField = provider === 'gopeople' ? 'gopeople_status' : 'auspost_status';

      const successfulLogisticsLocationCounts = orderTrackingArray.reduce((counts, entry) => {
        if (entry[statusField] === true && entry.location) {
          counts[entry.location] = (counts[entry.location] || 0) + 1;
        }
        return counts;
      }, {});

      console.log(`Batch Management: Updating batch numbers based on successful ${provider} orders:`, successfulLogisticsLocationCounts);
      const finalBatchNumbers = await this.batchService.updateBatchNumbers(deliveryDate, successfulLogisticsLocationCounts, currentBatchNumbers, isSameDay);

      orderTrackingArray.forEach(entry => {
        if (entry.location && finalBatchNumbers[entry.location] !== undefined) {
          entry.batch = finalBatchNumbers[entry.location];
        }
      });

      console.log(`Updated tracking array with final batch numbers for ${orderTrackingArray.length} orders`);
      return finalBatchNumbers;
    } else {
      console.log('Batch Management: No batch updates - no orders to process');
      return { ...currentBatchNumbers };
    }
  }

  async preCreateFolders(orderTrackingArray, deliveryDate, finalBatchNumbers) {
    if (orderTrackingArray.length > 0) {
      const successfulLogisticsOrders = orderTrackingArray.filter(entry =>
        entry.gopeople_status === true || entry.auspost_status === true
      );

      if (successfulLogisticsOrders.length > 0) {
        console.log('=== Starting Google Drive folder pre-creation ===');
        console.log(`Pre-creating folders for ${successfulLogisticsOrders.length} successful logistics orders`);
        
        try {
          const gdriveService = new GoogleDriveService();

          const folderPreCreationResults = await gdriveService.preCreateFolderStructure(
            successfulLogisticsOrders,
            deliveryDate,
            finalBatchNumbers
          );
          
          console.log('Folder pre-creation completed:', folderPreCreationResults.summary);
          
          if (folderPreCreationResults.failedFolders.length > 0) {
            console.error('Failed folder creations:', folderPreCreationResults.failedFolders);
          }
          
          return folderPreCreationResults;
        } catch (error) {
          console.error('Error during folder pre-creation:', error.message);
          return {
            success: false,
            error: error.message,
            summary: {
              totalLocations: 0,
              successfulCreations: 0,
              failedCreations: 0
            }
          };
        } finally {
          console.log('=== Folder pre-creation step completed ===');
        }
      } else {
        console.log('No successful logistics orders, skipping folder pre-creation');
      }
    }
    return null;
  }

  async executePersonalizedAndPackingSteps(orderTrackingArray, scriptExecutor, results, executionDetails, finalBatchNumbers, deliveryDate) {
    let successCount = 0;
    let failureCount = 0;

    if (orderTrackingArray.length > 0) {
      const successfulLogisticsOrderIds = orderTrackingArray
        .filter(entry => entry.gopeople_status === true || entry.auspost_status === true)
        .map(entry => entry.id);

      const successfulLogisticsOrderNumbers = orderTrackingArray
        .filter(entry => entry.gopeople_status === true || entry.auspost_status === true)
        .map(entry => entry.order_number);

      if (successfulLogisticsOrderIds.length > 0) {
        const extendedParams = { ...this.requestParams, orderIds: successfulLogisticsOrderIds, orderNumbers: successfulLogisticsOrderNumbers };

        console.log(`Executing personalized script with ${successfulLogisticsOrderIds.length} orders that passed logistics validation...`);
        const personalizedResult = await scriptExecutor.executeScript('personalized', this.SCRIPTS_CONFIG.personalized, extendedParams);

        if (personalizedResult.success) {
          // Add batch information to personalized data
          let personalizedDataWithBatch = this.addBatchInfoToData(personalizedResult.data, finalBatchNumbers, deliveryDate);
          const tempPersonalizedData = personalizedDataWithBatch;

          const { data: personalizedData, processedOrderNumbers: personalizedProcessedOrderNumbers, scriptKey: personalizedScriptKey, ...personalizedExecutionInfo } = personalizedResult;
          executionDetails['personalized'] = personalizedExecutionInfo;

          // Store processed order numbers for later status update after API calls
          console.log(`✅ Personalized script succeeded. Processed ${personalizedProcessedOrderNumbers.length} orders. Status will be updated after API calls.`);
          successCount++;
          
          // Execute packing slip and message cards processing
          console.log(`Executing packing-message script with ${successfulLogisticsOrderIds.length} orders...`);
          const packingMessageParams = { ...this.requestParams, orderIds: successfulLogisticsOrderIds, orderNumbers: successfulLogisticsOrderNumbers, finalBatchNumbers: finalBatchNumbers };
          
          const packingMessageResult = await scriptExecutor.executeScript('packing_message', this.SCRIPTS_CONFIG.packing_message, packingMessageParams);

          if (packingMessageResult.success) {
            let packingMessageDataWithBatch = this.addBatchInfoToPackingData(packingMessageResult.data, finalBatchNumbers, deliveryDate);

            const combinedData = ResponseFormatter.combinePersonalizedAndPackingMessage(tempPersonalizedData, packingMessageDataWithBatch);
            results['personalized_packingslip_notes'] = combinedData;

            const { data: packingMessageData, processedOrderNumbers: packingMessageProcessedOrderNumbers, scriptKey: packingMessageScriptKey, ...packingMessageExecutionInfo } = packingMessageResult;
            executionDetails['packing_message'] = packingMessageExecutionInfo;

            // Store processed order numbers for later status update after API calls
            console.log(`✅ Packing-message script succeeded. Processed ${packingMessageProcessedOrderNumbers.length} orders. Status will be updated after API calls.`);
            successCount++;
          } else {
            results['personalized_packingslip_notes'] = tempPersonalizedData;
            
            const { data: packingMessageData, processedOrderNumbers: packingMessageProcessedOrderNumbers, scriptKey: packingMessageScriptKey, ...packingMessageExecutionInfo } = packingMessageResult;
            executionDetails['packing_message'] = packingMessageExecutionInfo;
            failureCount++;
          }
        } else {
          this.handlePersonalizedFailure(personalizedResult, results, executionDetails);
          failureCount += 2; // Both personalized and packing-message failed
        }
      } else {
        this.handleNoOrdersForPersonalized(results, executionDetails, 'No orders passed logistics validation');
        failureCount += 2;
      }
    } else {
      this.handleNoOrdersForPersonalized(results, executionDetails, 'No orders found to process');
      failureCount += 2;
    }
    
    return { personalizedResults: { successCount, failureCount }, packingResults: {} };
  }

  addBatchInfoToData(data, finalBatchNumbers, deliveryDate) {
    if (Array.isArray(data)) {
      return data.map(locationEntry => {
        if (typeof locationEntry === 'string') {
          const parsed = JSON.parse(locationEntry);
          if (parsed.location && finalBatchNumbers[parsed.location] !== undefined) {
            parsed.batch = finalBatchNumbers[parsed.location];
          }
          // Add delivery_date in yyyy-mm-dd format
          if (deliveryDate) {
            parsed.delivery_date = deliveryDate;
          }
          return JSON.stringify(parsed);
        } else if (typeof locationEntry === 'object' && locationEntry.location) {
          if (finalBatchNumbers[locationEntry.location] !== undefined) {
            locationEntry.batch = finalBatchNumbers[locationEntry.location];
          }
          // Add delivery_date in yyyy-mm-dd format
          if (deliveryDate) {
            locationEntry.delivery_date = deliveryDate;
          }
          return JSON.stringify(locationEntry);
        }
        return JSON.stringify(locationEntry);
      });
    }
    return data;
  }

  addBatchInfoToPackingData(data, finalBatchNumbers, deliveryDate) {
    if (Array.isArray(data)) {
      return data.map(locationEntry => {
        if (typeof locationEntry === 'object' && locationEntry.location) {
          if (finalBatchNumbers[locationEntry.location] !== undefined) {
            locationEntry.batch = finalBatchNumbers[locationEntry.location];
            locationEntry.shop_id = 10;
          }
          // Ensure delivery_date is in yyyy-mm-dd format
          if (deliveryDate) {
            locationEntry.delivery_date = deliveryDate;
          }
        }
        return locationEntry;
      });
    }
    return data;
  }

  // Removed updateTrackingArrayPersonalized and updateTrackingArrayPacking methods
  // Status is now updated in updateTrackingArrayWithApiResults after API calls complete

  handlePersonalizedFailure(personalizedResult, results, executionDetails) {
    results['personalized_packingslip_notes'] = null;
    
    const { data: personalizedData, processedOrderNumbers: personalizedProcessedOrderNumbers, scriptKey: personalizedScriptKey, ...personalizedExecutionInfo } = personalizedResult;
    executionDetails['personalized'] = personalizedExecutionInfo;
    
    executionDetails['packing_message'] = {
      scriptKey: 'packing_message',
      name: 'Packing Slip and Message Cards',
      success: false,
      skipped: true,
      reason: 'Personalized script failed',
      executionTime: 0,
      timestamp: new Date().toISOString(),
      appliedParams: this.requestParams
    };
  }

  handleNoOrdersForPersonalized(results, executionDetails, reason) {
    console.log(`${reason}. Skipping personalized and packing-message scripts.`);
    
    results['personalized_packingslip_notes'] = null;
    executionDetails['personalized'] = {
      scriptKey: 'personalized',
      name: 'Personalized Products Report',
      success: false,
      skipped: true,
      reason: reason,
      executionTime: 0,
      timestamp: new Date().toISOString(),
      appliedParams: this.requestParams
    };
    
    executionDetails['packing_message'] = {
      scriptKey: 'packing_message',
      name: 'Packing Slip and Message Cards',
      success: false,
      skipped: true,
      reason: reason,
      executionTime: 0,
      timestamp: new Date().toISOString(),
      appliedParams: this.requestParams
    };
  }

  async processPolaroidImages(results, deliveryDate, finalBatchNumbers) {
    if (results['personalized_packingslip_notes'] && Array.isArray(results['personalized_packingslip_notes'])) {
      const polaroidData = results['personalized_packingslip_notes']
        .map(item => {
          try {
            const parsed = typeof item === 'string' ? JSON.parse(item) : item;
            return parsed.polaroid_photo_data ? parsed : null;
          } catch (error) {
            console.error('Error parsing personalized item:', error);
            return null;
          }
        })
        .filter(item => item && item.polaroid_photo_data);

      if (polaroidData.length > 0) {
        console.log(`Processing ${polaroidData.length} locations with polaroid data...`);
        console.log('Note: Folders should already exist from pre-creation step');
        
        try {
          const gdriveService = new GoogleDriveService();
          
          const polaroidProcessingResults = await gdriveService.processPolaroidImages(
            polaroidData, 
            deliveryDate, 
            finalBatchNumbers
          );
          
          console.log('Polaroid processing completed:', polaroidProcessingResults.summary);
          return polaroidProcessingResults;
        } catch (error) {
          console.error('Error processing polaroid images:', error.message);
          return {
            success: false,
            error: error.message,
            summary: {
              totalImages: 0,
              successfulUploads: 0,
              failedUploads: 0,
              locationsProcessed: 0
            }
          };
        }
      } else {
        console.log('No polaroid data found in personalized results');
      }
    } else {
      console.log('No personalized results available for polaroid processing');
    }
    return null;
  }

  async executeFosUpdateStep(orderTrackingArray, executeFosUpdate_flag, scriptExecutor, results, executionDetails) {
    let successCount = 0;
    let failureCount = 0;

    console.log(`\n🔄 === FOS UPDATE API EXECUTION DECISION ===`);
    console.log(`📊 executeFosUpdate_flag: ${executeFosUpdate_flag} (dev_mode[4] = '${this.requestParams.dev_mode[4]}')`);

    if (orderTrackingArray.length > 0) {
      // Separate successful and unsuccessful orders
      const successfulOrders = orderTrackingArray.filter(entry =>
        entry.gopeople_status === true || entry.auspost_status === true
      );

      const unsuccessfulOrders = orderTrackingArray.filter(entry =>
        entry.gopeople_status !== true && entry.auspost_status !== true
      );

      const successfulOrderIds = successfulOrders.map(entry => entry.id);
      const successfulOrderNumbers = successfulOrders.map(entry => entry.order_number);

      const unsuccessfulOrderIds = unsuccessfulOrders.map(entry => entry.id);
      const unsuccessfulOrderNumbers = unsuccessfulOrders.map(entry => entry.order_number);

      console.log(`📋 Order status breakdown:`);
      console.log(`  - Successful logistics orders: ${successfulOrderIds.length}`);
      console.log(`  - Unsuccessful logistics orders: ${unsuccessfulOrderIds.length}`);
      console.log(`  - Total orders: ${orderTrackingArray.length}`);

      if ((successfulOrderIds.length > 0 || unsuccessfulOrderIds.length > 0) && executeFosUpdate_flag) {
        console.log(`✅ Decision: EXECUTING FOS Update calls for BOTH successful and unsuccessful orders`);
        console.log(`=== END FOS UPDATE API DECISION ===\n`);

        console.log(`Executing dual FOS_update: ${successfulOrderIds.length} successful → 'Processed', ${unsuccessfulOrderIds.length} unsuccessful → 'Hold'`);

        // Use the new dual execution method
        const fosUpdateResult = await scriptExecutor.executeFosUpdateDual(
          this.SCRIPTS_CONFIG.fos_update,
          successfulOrderIds,
          successfulOrderNumbers,
          unsuccessfulOrderIds,
          unsuccessfulOrderNumbers
        );

        if (fosUpdateResult.success) {
          results['fos_update'] = fosUpdateResult.data;

          const { data: fosData, processedOrderNumbers: fosProcessedOrderNumbers, scriptKey: fosScriptKey, ...fosExecutionInfo } = fosUpdateResult;
          executionDetails['fos_update'] = fosExecutionInfo;

          this.updateTrackingArrayFos(fosProcessedOrderNumbers, orderTrackingArray);

          // Send email notifications for unsuccessful orders
          let emailResults = null;
          if (unsuccessfulOrderIds.length > 0) {
            console.log(`\n📧 Triggering email notifications for ${unsuccessfulOrderIds.length} unsuccessful orders...`);
            try {
              emailResults = await this.emailService.sendUnsuccessfulOrdersEmails(unsuccessfulOrders);
              console.log(`📧 Email notifications completed: ${emailResults.totalSent} sent, ${emailResults.totalFailed} failed`);

              // Add email results to execution details
              executionDetails['fos_update'].emailResults = emailResults;
            } catch (error) {
              console.error(`❌ Error sending email notifications:`, error.message);
              executionDetails['fos_update'].emailResults = {
                totalSent: 0,
                totalFailed: unsuccessfulOrderIds.length,
                error: error.message,
                results: []
              };
            }
          } else {
            console.log(`📧 No unsuccessful orders, skipping email notifications`);
            executionDetails['fos_update'].emailResults = {
              totalSent: 0,
              totalFailed: 0,
              results: []
            };
          }

          successCount++;
        } else {
          results['fos_update'] = null;

          const { data: fosData, processedOrderNumbers: fosProcessedOrderNumbers, scriptKey: fosScriptKey, ...fosExecutionInfo } = fosUpdateResult;
          executionDetails['fos_update'] = fosExecutionInfo;
          failureCount++;
        }
      } else if (!executeFosUpdate_flag) {
        console.log(`❌ Decision: SKIPPING FOS Update calls (dev_mode flag disabled)`);
        console.log(`=== END FOS UPDATE API DECISION ===\n`);
        this.handleFosSkipped(results, executionDetails, 'Skipped due to dev_mode flag');
        failureCount++;
      } else {
        console.log(`❌ Decision: SKIPPING FOS Update calls (no orders available)`);
        console.log(`=== END FOS UPDATE API DECISION ===\n`);
        this.handleFosSkipped(results, executionDetails, 'No orders available for processing');
        failureCount++;
      }
    } else {
      this.handleFosSkipped(results, executionDetails, 'No orders found to process');
      failureCount++;
    }

    return { successCount, failureCount };
  }

  updateTrackingArrayFos(fosProcessedOrderNumbers, orderTrackingArray) {
    if (fosProcessedOrderNumbers && fosProcessedOrderNumbers.length > 0) {
      fosProcessedOrderNumbers.forEach(orderNumber => {
        const trackingEntry = orderTrackingArray.find(entry => entry.order_number === orderNumber);
        if (trackingEntry) {
          trackingEntry.updateProcessingStatus = true;
        }
      });
      console.log(`Updated updateProcessingStatus for ${fosProcessedOrderNumbers.length} orders`);
    }
  }

  handleFosSkipped(results, executionDetails, reason) {
    console.log(`Dev mode: Skipping FOS_update script execution`);

    results['fos_update'] = null;
    executionDetails['fos_update'] = {
      scriptKey: 'fos_update',
      name: 'FOS Update Script',
      success: false,
      skipped: true,
      reason: reason,
      devModeSkipped: true,
      executionTime: 0,
      timestamp: new Date().toISOString(),
      appliedParams: this.requestParams
    };
  }

  async executePersonalizedApiStep(executePersonalizedApiCalls_flag, results, executionDetails) {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    try {
      console.log(`\n📄 === PERSONALIZED API EXECUTION DECISION ===`);
      console.log(`📊 executePersonalizedApiCalls_flag: ${executePersonalizedApiCalls_flag} (dev_mode[1] = '${this.requestParams.dev_mode[1]}')`);

      const personalizedData = results['personalized_packingslip_notes'];
      console.log(`📋 Personalized data available: ${personalizedData ? 'YES' : 'NO'} (${personalizedData ? personalizedData.length : 0} entries)`);

      if (!executePersonalizedApiCalls_flag) {
        console.log(`❌ Decision: SKIPPING Personalized API calls (dev_mode flag disabled)`);
        console.log(`=== END PERSONALIZED API DECISION ===\n`);
        this.handlePersonalizedApiSkipped(results, executionDetails, 'Skipped due to dev_mode flag');
        return { successCount: 0, failureCount: 1 };
      }

      if (!personalizedData) {
        console.log(`❌ Decision: SKIPPING Personalized API calls (no data available)`);
        console.log(`=== END PERSONALIZED API DECISION ===\n`);
        this.handlePersonalizedApiSkipped(results, executionDetails, 'No personalized_packingslip_notes data available');
        return { successCount: 0, failureCount: 1 };
      }

      console.log(`✅ Decision: EXECUTING Personalized API calls`);
      console.log(`=== END PERSONALIZED API DECISION ===\n`);

      console.log('Executing Personalized API service...');

      // Validate configuration before making API calls
      const configValidation = this.personalizedApiService.validateConfiguration();
      if (!configValidation.valid) {
        throw new Error(`Configuration validation failed: ${configValidation.issues.join(', ')}`);
      }

      const apiResults = await this.personalizedApiService.processPersonalizedPackingNotes(personalizedData);

      // Store the results
      results['personalized_api_service'] = apiResults;

      executionDetails['personalized_api_service'] = {
        scriptKey: 'personalized_api_service',
        name: 'Personalized API Service',
        success: apiResults.success,
        skipped: false,
        devModeSkipped: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        appliedParams: this.requestParams,
        processingSummary: apiResults.summary,
        processedEndpoints: apiResults.processedEndpoints.length,
        fieldValidation: apiResults.fieldValidation,
        errors: apiResults.errors
      };

      if (apiResults.success) {
        console.log(`Personalized API service completed successfully. Processed ${apiResults.summary.totalProcessed} data types with ${apiResults.summary.successfulCalls} successful calls.`);
        successCount = 1;
      } else {
        console.log(`Personalized API service completed with errors: ${apiResults.errors.join(', ')}`);
        failureCount = 1;
      }

    } catch (error) {
      console.error('Personalized API service error:', error.message);

      results['personalized_api_service'] = {
        success: false,
        error: error.message
      };

      executionDetails['personalized_api_service'] = {
        scriptKey: 'personalized_api_service',
        name: 'Personalized API Service',
        success: false,
        skipped: false,
        devModeSkipped: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        appliedParams: this.requestParams,
        error: error.message
      };

      failureCount = 1;
    }

    return { successCount, failureCount };
  }

  handlePersonalizedApiSkipped(results, executionDetails, reason) {
    console.log(`Personalized API service: ${reason}`);

    results['personalized_api_service'] = null;
    executionDetails['personalized_api_service'] = {
      scriptKey: 'personalized_api_service',
      name: 'Personalized API Service',
      success: false,
      skipped: true,
      reason: reason,
      devModeSkipped: reason.includes('dev_mode'),
      executionTime: 0,
      timestamp: new Date().toISOString(),
      appliedParams: this.requestParams
    };
  }

  async executeProductTallyStep(orderTrackingArray, executeProductTallyApiCalls_flag, deliveryDate, finalBatchNumbers, results, executionDetails) {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    try {
      console.log(`\n📊 === PRODUCT TALLY EXECUTION DECISION ===`);
      console.log(`📊 executeProductTallyApiCalls_flag: ${executeProductTallyApiCalls_flag} (dev_mode[3] = '${this.requestParams.dev_mode[3]}')`);

      // Filter successful logistics orders (gopeople OR auspost)
      const successfulLogisticsOrders = orderTrackingArray.filter(order =>
        order.gopeople_status === true || order.auspost_status === true
      );

      console.log(`📋 Successful logistics orders available: ${successfulLogisticsOrders.length} (out of ${orderTrackingArray.length} total orders)`);

      if (successfulLogisticsOrders.length === 0) {
        console.log(`❌ Decision: SKIPPING Product Tally (no successful logistics orders)`);
        console.log(`=== END PRODUCT TALLY DECISION ===\n`);
        this.handleProductTallySkipped(results, executionDetails, 'No successful logistics orders available');
        return { successCount: 0, failureCount: 1 };
      }

      if (executeProductTallyApiCalls_flag) {
        console.log(`✅ Decision: EXECUTING Product Tally calculation AND API calls`);
      } else {
        console.log(`✅ Decision: EXECUTING Product Tally calculation ONLY (API calls disabled)`);
      }
      console.log(`=== END PRODUCT TALLY DECISION ===\n`);

      console.log('Executing Product Tally service...');

      const tallyResults = await this.productTallyService.calculateAndSubmitTallies(
        successfulLogisticsOrders,
        deliveryDate,
        finalBatchNumbers,
        executeProductTallyApiCalls_flag
      );

      // Store the results
      results['product_tally'] = tallyResults;

      executionDetails['product_tally'] = {
        scriptKey: 'product_tally',
        name: 'Product Tally Service',
        success: tallyResults.success,
        skipped: false,
        devModeSkipped: false,
        executionTime: tallyResults.executionTime,
        timestamp: new Date().toISOString(),
        appliedParams: this.requestParams,
        locationsProcessed: tallyResults.locationsProcessed.length,
        apiCallsEnabled: executeProductTallyApiCalls_flag,
        apiCallsSummary: tallyResults.apiCalls,
        calculations: tallyResults.calculations,
        errors: tallyResults.errors
      };

      if (tallyResults.success) {
        console.log(`Product Tally service completed successfully. Processed ${tallyResults.locationsProcessed.length} location(s).`);
        if (executeProductTallyApiCalls_flag) {
          console.log(`API calls: ${tallyResults.apiCalls.success} successful, ${tallyResults.apiCalls.failed} failed.`);
        }
        successCount = 1;
      } else {
        console.log(`Product Tally service completed with errors: ${tallyResults.errors.map(e => e.error).join(', ')}`);
        failureCount = 1;
      }

    } catch (error) {
      console.error('Product Tally service error:', error.message);

      results['product_tally'] = {
        success: false,
        error: error.message
      };

      executionDetails['product_tally'] = {
        scriptKey: 'product_tally',
        name: 'Product Tally Service',
        success: false,
        skipped: false,
        devModeSkipped: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        appliedParams: this.requestParams,
        error: error.message
      };

      failureCount = 1;
    }

    return { successCount, failureCount };
  }

  handleProductTallySkipped(results, executionDetails, reason) {
    console.log(`Product Tally service: ${reason}`);

    results['product_tally'] = null;
    executionDetails['product_tally'] = {
      scriptKey: 'product_tally',
      name: 'Product Tally Service',
      success: false,
      skipped: true,
      reason: reason,
      devModeSkipped: false,
      executionTime: 0,
      timestamp: new Date().toISOString(),
      appliedParams: this.requestParams
    };
  }

  async executeGpLabelsStep(executeGpLabelsApiCalls_flag, gopeopleResults, results, executionDetails, finalBatchNumbers) {
    const startTime = Date.now();

    try {
      console.log(`\n🏷️ === GP LABELS API EXECUTION DECISION ===`);
      console.log(`📊 executeGpLabelsApiCalls_flag: ${executeGpLabelsApiCalls_flag} (dev_mode[2] = '${this.requestParams.dev_mode[2]}')`);
      console.log(`📋 Successful GoPeople orders available: ${gopeopleResults?.successfulOrders?.length || 0}`);

      if (!executeGpLabelsApiCalls_flag) {
        console.log(`❌ Decision: SKIPPING GP Labels API calls (dev_mode flag disabled)`);
        console.log(`=== END GP LABELS API DECISION ===\n`);
        this.handleGpLabelsApiSkipped(results, executionDetails, 'Skipped due to dev_mode flag');
        return null;
      }

      if (!gopeopleResults || !gopeopleResults.successfulOrders || gopeopleResults.successfulOrders.length === 0) {
        console.log(`❌ Decision: SKIPPING GP Labels API calls (no successful GoPeople orders)`);
        console.log(`=== END GP LABELS API DECISION ===\n`);
        this.handleGpLabelsApiSkipped(results, executionDetails, 'No successful GoPeople orders available for GP labels processing');
        return null;
      }

      console.log(`✅ Decision: EXECUTING GP Labels API calls`);
      console.log(`=== END GP LABELS API DECISION ===\n`);

      console.log('Re-processing GP Labels data with correct batch numbers...');
      const gpLabelsData = this.gopeopleService.processLabelsData(gopeopleResults.successfulOrders, finalBatchNumbers);

      if (!gpLabelsData || Object.keys(gpLabelsData).length === 0) {
        this.handleGpLabelsApiSkipped(results, executionDetails, 'No GP labels data generated');
        return null;
      }

      console.log('Executing GP Labels API service...');

      // Validate configuration before making API calls
      const configValidation = this.gpLabelsApiService.validateConfiguration();
      if (!configValidation.valid) {
        throw new Error(`GP Labels API configuration validation failed: ${configValidation.issues.join(', ')}`);
      }

      const apiResults = await this.gpLabelsApiService.processGpLabelsData(gpLabelsData);

      // Store the results
      results['gp_labels_api_service'] = apiResults;

      executionDetails['gp_labels_api_service'] = {
        scriptKey: 'gp_labels_api_service',
        name: 'GoPeople Labels API Service',
        success: apiResults.success,
        skipped: false,
        devModeSkipped: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        appliedParams: this.requestParams,
        processingSummary: apiResults.summary,
        processedBatches: apiResults.processedBatches.length,
        errors: apiResults.errors
      };

      if (apiResults.success) {
        console.log(`GP Labels API service completed successfully. Processed ${apiResults.summary.totalBatches} batches with ${apiResults.summary.successfulCalls} successful calls.`);
      } else {
        console.log(`GP Labels API service completed with errors: ${apiResults.errors.join(', ')}`);
      }

      return {
        success: apiResults.success,
        gpLabelsData: gpLabelsData,
        apiResults: apiResults
      };

    } catch (error) {
      console.error('GP Labels API service error:', error.message);

      results['gp_labels_api_service'] = {
        success: false,
        error: error.message
      };

      executionDetails['gp_labels_api_service'] = {
        scriptKey: 'gp_labels_api_service',
        name: 'GoPeople Labels API Service',
        success: false,
        skipped: false,
        devModeSkipped: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        appliedParams: this.requestParams,
        error: error.message
      };

      return {
        success: false,
        error: error.message
      };
    }
  }

  handleGpLabelsApiSkipped(results, executionDetails, reason) {
    console.log(`GP Labels API service: ${reason}`);

    results['gp_labels_api_service'] = null;
    executionDetails['gp_labels_api_service'] = {
      scriptKey: 'gp_labels_api_service',
      name: 'GoPeople Labels API Service',
      success: false,
      skipped: true,
      reason: reason,
      devModeSkipped: reason.includes('dev_mode'),
      executionTime: 0,
      timestamp: new Date().toISOString(),
      appliedParams: this.requestParams
    };

    return null;
  }

  async executeAuspostLabelsStep(executeGpLabelsApiCalls_flag, auspostResults, results, executionDetails, finalBatchNumbers) {
    const startTime = Date.now();

    try {
      console.log(`\n🏷️  === AUSPOST LABELS GENERATION & DOWNLOAD DECISION ===`);
      console.log(`📊 executeGpLabelsApiCalls_flag: ${executeGpLabelsApiCalls_flag} (dev_mode[2] = '${this.requestParams.dev_mode[2]}')`);
      console.log(`📋 Successful AusPost orders available: ${auspostResults?.successfulOrders?.length || 0}`);

      if (!executeGpLabelsApiCalls_flag) {
        console.log(`❌ Decision: SKIPPING AusPost Labels generation (dev_mode flag disabled)`);
        console.log(`=== END AUSPOST LABELS DECISION ===\n`);
        this.handleAuspostLabelsApiSkipped(results, executionDetails, 'Skipped due to dev_mode flag');
        return null;
      }

      if (!auspostResults || !auspostResults.successfulOrders || auspostResults.successfulOrders.length === 0) {
        console.log(`❌ Decision: SKIPPING AusPost Labels generation (no successful AusPost orders)`);
        console.log(`=== END AUSPOST LABELS DECISION ===\n`);
        this.handleAuspostLabelsApiSkipped(results, executionDetails, 'No successful AusPost orders available for labels processing');
        return null;
      }

      console.log(`✅ Decision: EXECUTING AusPost Labels generation and download`);
      console.log(`=== END AUSPOST LABELS DECISION ===\n`);

      // Step 1: Generate label URLs using new AusPost Labels API
      console.log('Step 1: Generating label URLs via AusPost Labels API...');
      const labelsByLocation = await this.auspostService.processNewLabelsGeneration(
        auspostResults.successfulOrders,
        finalBatchNumbers
      );

      if (!labelsByLocation || Object.keys(labelsByLocation).length === 0) {
        this.handleAuspostLabelsApiSkipped(results, executionDetails, 'No label URLs generated from AusPost API');
        return null;
      }

      console.log(`✅ Generated label URLs for ${Object.keys(labelsByLocation).length} locations`);

      // Step 2: Download PDFs and upload to Google Drive
      console.log('\nStep 2: Downloading PDFs and uploading to Google Drive...');
      const downloadResults = await this.auspostLabelsDownloadService.processLabels(labelsByLocation);

      // Store the results
      results['auspost_labels_api_service'] = downloadResults;

      executionDetails['auspost_labels_api_service'] = {
        scriptKey: 'auspost_labels_api_service',
        name: 'AusPost Labels Generation & Download Service',
        success: downloadResults.success,
        skipped: false,
        devModeSkipped: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        appliedParams: this.requestParams,
        processingSummary: downloadResults.summary,
        processedLocations: downloadResults.processedLocations.length,
        errors: downloadResults.errors,
        labelsByLocation: Object.keys(labelsByLocation)
      };

      if (downloadResults.success) {
        console.log(`AusPost Labels service completed successfully. Processed ${downloadResults.summary.totalLocations} locations with ${downloadResults.summary.successfulUploads} successful uploads.`);
      } else {
        console.log(`AusPost Labels service completed with errors: ${downloadResults.errors.join(', ')}`);
      }

      return {
        success: downloadResults.success,
        labelsByLocation: labelsByLocation,
        downloadResults: downloadResults
      };

    } catch (error) {
      console.error('AusPost Labels service error:', error.message);

      results['auspost_labels_api_service'] = {
        success: false,
        error: error.message
      };

      executionDetails['auspost_labels_api_service'] = {
        scriptKey: 'auspost_labels_api_service',
        name: 'AusPost Labels Generation & Download Service',
        success: false,
        skipped: false,
        devModeSkipped: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        appliedParams: this.requestParams,
        error: error.message
      };

      return {
        success: false,
        error: error.message
      };
    }
  }

  handleAuspostLabelsApiSkipped(results, executionDetails, reason) {
    console.log(`AusPost Labels API service: ${reason}`);

    results['auspost_labels_api_service'] = null;
    executionDetails['auspost_labels_api_service'] = {
      scriptKey: 'auspost_labels_api_service',
      name: 'AusPost Labels API Service',
      success: false,
      skipped: true,
      reason: reason,
      devModeSkipped: reason.includes('dev_mode'),
      executionTime: 0,
      timestamp: new Date().toISOString(),
      appliedParams: this.requestParams
    };

    return null;
  }

  updateTrackingArrayWithApiResults(orderTrackingArray, personalizedApiResults) {
    console.log('\n🔄 === UPDATING TRACKING ARRAY WITH API RESULTS ===');
    console.log(`API Results available: ${personalizedApiResults ? 'YES' : 'NO'}`);
    console.log(`API Success: ${personalizedApiResults?.success || false}`);

    const apiSuccess = personalizedApiResults && personalizedApiResults.success;
    const ordersWithPersonalizedData = new Set();
    const ordersWithPackingSlips = new Set();
    const ordersWithMessageCards = new Set();

    if (apiSuccess && personalizedApiResults.apiResults) {
      // Extract order numbers that were successfully processed by the API
      try {
        const personalizedData = personalizedApiResults.apiResults.processedEndpoints;
        console.log(`Processing ${personalizedData.length} API endpoint results...`);

        personalizedData.forEach(endpointResult => {
          if (endpointResult.success && endpointResult.entryObject) {
            const entryData = endpointResult.entryObject;

            // Extract from packing slips
            if (entryData.packing_slips_data && Array.isArray(entryData.packing_slips_data)) {
              entryData.packing_slips_data.forEach(item => {
                if (item.order_number) {
                  ordersWithPackingSlips.add(item.order_number);
                  ordersWithPersonalizedData.add(item.order_number);
                }
              });
            }

            // Extract from message cards (batched data)
            if (entryData.message_cards_data && Array.isArray(entryData.message_cards_data)) {
              entryData.message_cards_data.forEach(batch => {
                // Each batch can have multiple message_cards_data1, message_cards_data2, etc.
                Object.keys(batch).forEach(key => {
                  if (key.startsWith('message_cards_data') && batch[key].order_number) {
                    ordersWithMessageCards.add(batch[key].order_number);
                    ordersWithPersonalizedData.add(batch[key].order_number);
                  }
                });
              });
            }

            // Extract from personalized items (jars, candles, prosecco)
            ['jars_luxe_data', 'jars_classic_large_data', 'prosecco_data', 'candles_plants_data', 'polaroid_photo_data'].forEach(dataType => {
              if (entryData[dataType] && Array.isArray(entryData[dataType])) {
                // These don't have order_number, but their presence indicates processing
                // We'll mark orders as having personalized data if they appear in any category
                console.log(`Found ${dataType} with ${entryData[dataType].length} batches`);
              }
            });
          }
        });

        console.log(`📊 Extracted order numbers:`);
        console.log(`  - With packing slips: ${ordersWithPackingSlips.size}`);
        console.log(`  - With message cards: ${ordersWithMessageCards.size}`);
        console.log(`  - With personalized data: ${ordersWithPersonalizedData.size}`);
      } catch (error) {
        console.error('❌ Error parsing API results for tracking update:', error);
      }
    }

    // Update tracking array based on API success
    let updatedCount = 0;
    orderTrackingArray.forEach(entry => {
      if (apiSuccess) {
        // API succeeded - set status based on actual data
        const hasPackingSlip = ordersWithPackingSlips.has(entry.order_number);
        const hasMessageCard = ordersWithMessageCards.has(entry.order_number);
        const hasPersonalized = ordersWithPersonalizedData.has(entry.order_number);

        entry.packing_slip_status = hasPackingSlip;
        entry.message_cards_status = hasMessageCard;
        entry.personalized_status = hasPersonalized;

        if (hasPackingSlip || hasMessageCard || hasPersonalized) {
          updatedCount++;
          console.log(`✅ Order ${entry.order_number}: packing=${hasPackingSlip}, message=${hasMessageCard}, personalized=${hasPersonalized}`);
        }
      } else {
        // API was skipped or failed - set all to false
        entry.personalized_status = false;
        entry.packing_slip_status = false;
        entry.message_cards_status = false;
      }
    });

    console.log(`\n📈 Tracking array update summary:`);
    console.log(`  - Total orders: ${orderTrackingArray.length}`);
    console.log(`  - Orders with successful processing: ${updatedCount}`);
    console.log(`  - API Status: ${apiSuccess ? 'SUCCESS ✅' : 'FAILED/SKIPPED ❌'}`);
    console.log(`=== END TRACKING ARRAY UPDATE ===\n`);
  }

  async executeGoogleSheetsWriteStep(orderTrackingArray, executeGoogleSheetsWrite_flag, results, executionDetails) {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    try {
      console.log(`\n📊 === GOOGLE SHEETS WRITE DECISION ===`);
      console.log(`📊 executeGoogleSheetsWrite_flag: ${executeGoogleSheetsWrite_flag} (dev_mode[4] = '${this.requestParams.dev_mode[4]}')`);
      console.log(`📋 Orders in tracking array: ${orderTrackingArray.length}`);

      if (!executeGoogleSheetsWrite_flag) {
        console.log(`❌ Decision: SKIPPING Google Sheets write (dev_mode flag disabled)`);
        console.log(`=== END GOOGLE SHEETS WRITE DECISION ===\n`);
        this.handleGoogleSheetsSkipped(results, executionDetails, 'Skipped due to dev_mode flag');
        return { successCount: 0, failureCount: 1 };
      }

      if (!orderTrackingArray || orderTrackingArray.length === 0) {
        console.log(`❌ Decision: SKIPPING Google Sheets write (no orders available)`);
        console.log(`=== END GOOGLE SHEETS WRITE DECISION ===\n`);
        this.handleGoogleSheetsSkipped(results, executionDetails, 'No orders available to write');
        return { successCount: 0, failureCount: 1 };
      }

      console.log(`✅ Decision: EXECUTING Google Sheets write`);
      console.log(`=== END GOOGLE SHEETS WRITE DECISION ===\n`);

      console.log('Executing Google Sheets write service...');

      // Validate configuration before writing
      const configValidation = this.googleSheetsService.validateConfiguration();
      if (!configValidation.valid) {
        throw new Error(`Google Sheets configuration validation failed: ${configValidation.issues.join(', ')}`);
      }

      // Write orders to Orders sheet
      const writeResults = await this.googleSheetsService.appendOrdersToSheet(orderTrackingArray);

      // Generate and write batch details to Batches sheet
      const batchDetails = this.googleSheetsService.generateBatchDetails(orderTrackingArray);
      const batchWriteResults = await this.googleSheetsService.appendBatchDetailsToSheet(batchDetails);

      // Combine results
      const combinedSuccess = writeResults.success && batchWriteResults.success;
      const combinedResults = {
        success: combinedSuccess,
        orders: writeResults,
        batches: batchWriteResults,
        batchDetails: batchDetails // Include batch details for response
      };

      // Store the results
      results['google_sheets_write'] = combinedResults;

      executionDetails['google_sheets_write'] = {
        scriptKey: 'google_sheets_write',
        name: 'Google Sheets Write Service',
        success: combinedSuccess,
        skipped: false,
        devModeSkipped: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        appliedParams: this.requestParams,
        ordersWritten: writeResults.rowsWritten,
        batchesWritten: batchWriteResults.rowsWritten,
        spreadsheetId: writeResults.spreadsheetId,
        ordersSheetName: writeResults.sheetName,
        batchesSheetName: batchWriteResults.sheetName,
        ordersError: writeResults.error || null,
        batchesError: batchWriteResults.error || null
      };

      if (combinedSuccess) {
        console.log(`Google Sheets write completed successfully. Wrote ${writeResults.rowsWritten} order rows and ${batchWriteResults.rowsWritten} batch rows.`);
        successCount = 1;
      } else {
        console.log(`Google Sheets write completed with errors. Orders: ${writeResults.error || 'OK'}, Batches: ${batchWriteResults.error || 'OK'}`);
        failureCount = 1;
      }

    } catch (error) {
      console.error('Google Sheets write service error:', error.message);

      results['google_sheets_write'] = {
        success: false,
        error: error.message
      };

      executionDetails['google_sheets_write'] = {
        scriptKey: 'google_sheets_write',
        name: 'Google Sheets Write Service',
        success: false,
        skipped: false,
        devModeSkipped: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        appliedParams: this.requestParams,
        error: error.message
      };

      failureCount = 1;
    }

    return { successCount, failureCount };
  }

  handleGoogleSheetsSkipped(results, executionDetails, reason) {
    console.log(`Google Sheets write service: ${reason}`);

    results['google_sheets_write'] = null;
    executionDetails['google_sheets_write'] = {
      scriptKey: 'google_sheets_write',
      name: 'Google Sheets Write Service',
      success: false,
      skipped: true,
      reason: reason,
      devModeSkipped: reason.includes('dev_mode'),
      executionTime: 0,
      timestamp: new Date().toISOString(),
      appliedParams: this.requestParams
    };
  }

  formatManualResponse(orderTrackingArray, executionTime, successCount, failureCount) {
    console.log('\n📊 === FORMATTING MANUAL PROCESSING RESPONSE ===');

    const formattedOrders = orderTrackingArray.map(order => {
      const isSuccess = order.gopeople_status === true || order.auspost_status === true;
      const error = order.gopeople_error || order.auspost_error || null;

      return {
        order_number: order.order_number,
        success: isSuccess,
        error: isSuccess ? null : error
      };
    });

    const successfulCount = formattedOrders.filter(o => o.success).length;
    const unsuccessfulCount = formattedOrders.filter(o => !o.success).length;

    console.log(`Total orders: ${formattedOrders.length}`);
    console.log(`Successful: ${successfulCount}`);
    console.log(`Unsuccessful: ${unsuccessfulCount}`);
    console.log('=== END MANUAL RESPONSE FORMATTING ===\n');

    return {
      success: successfulCount > 0,
      testEndpoint: true,
      message: 'Manual order processing completed',
      summary: {
        total: formattedOrders.length,
        successful: successfulCount,
        unsuccessful: unsuccessfulCount
      },
      orders: formattedOrders,
      executionTime: executionTime
    };
  }
}

module.exports = OrderProcessingPipeline;