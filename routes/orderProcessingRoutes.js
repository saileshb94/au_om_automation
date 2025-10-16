const OrderProcessingPipeline = require('../services/OrderProcessingPipeline');
const ValidationHelper = require('../utils/ValidationHelper');
const ErrorHandler = require('../middleware/errorHandler');
const GoogleDriveService = require('../gdrive-service');
const GoPeopleTimeframeService = require('../services/GoPeopleTimeframeService');

class OrderProcessingRoutes {
  static createRoutes(app, dbConfig, gopeopleConfig, auspostConfig, scriptsConfig) {
    // Main route handler
    app.get('/', async (req, res) => {
      try {
        // Extract and validate query parameters
        const requestParams = ValidationHelper.parseAndValidateRequestParams(req.query);

        // Add source parameter for Zapier formatting
        requestParams.source = req.query.source;

        // Create and execute the processing pipeline
        const pipeline = new OrderProcessingPipeline(requestParams, dbConfig, gopeopleConfig, auspostConfig, scriptsConfig);
        const response = await pipeline.execute();

        res.status(200).json(response);
        
      } catch (error) {
        ErrorHandler.handle(error, res);
      }
    });

    // GoPeople timeframe endpoint
    app.get('/gopeopletimeframe', async (req, res) => {
      try {
        const { dateStart, dateEnd } = req.query;

        // Validate required parameters
        if (!dateStart || !dateEnd) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameters: dateStart and dateEnd are both required'
          });
        }

        console.log(`GoPeople timeframe request - dateStart: ${dateStart}, dateEnd: ${dateEnd}`);

        // Create service instance and make API call
        const timeframeService = new GoPeopleTimeframeService(
          gopeopleConfig.token,
          gopeopleConfig.timeframeUrl
        );
        const result = await timeframeService.getShiftTimeframe(dateStart, dateEnd);

        // Return the response
        if (result.success) {
          res.status(200).json(result.data);
        } else {
          res.status(result.statusCode || 500).json(result.data || { error: result.error });
        }

      } catch (error) {
        console.error('GoPeople timeframe endpoint error:', error.message);
        res.status(500).json({
          error: error.message
        });
      }
    });

    // FOS process orders endpoint
    app.post('/fos-process-orders-test', async (req, res) => {
      try {
        const { date, dev_mode, is_same_day, time_frame } = req.query;
        const orders = req.body;

        // Validate required parameters
        if (!date || !dev_mode || is_same_day === undefined) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameters: date, dev_mode, and is_same_day are all required'
          });
        }

        // Validate is_same_day is 0 or 1
        const isSameDayNum = parseInt(is_same_day);
        if (isSameDayNum !== 0 && isSameDayNum !== 1) {
          return res.status(400).json({
            success: false,
            error: 'Invalid is_same_day parameter: must be 0 or 1'
          });
        }

        // Validate date format (basic YYYY-MM-DD check)
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(date)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid date format: must be YYYY-MM-DD'
          });
        }

        // Validate orders is an array
        if (!Array.isArray(orders)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request body: must be an array of order objects'
          });
        }

        console.log(`FOS process orders request - date: ${date}, dev_mode: ${dev_mode}, is_same_day: ${is_same_day}, time_frame: ${time_frame || 'not provided'}`);
        console.log(`Orders count: ${orders.length}`);

        // Return success response with received parameters
        const responseParams = {
          date: date,
          dev_mode: dev_mode,
          is_same_day: isSameDayNum
        };

        if (time_frame) {
          responseParams.time_frame = time_frame;
        }

        res.status(200).json({
          success: true,
          message: 'Request received successfully',
          receivedParams: responseParams,
          orderCount: orders.length,
          orders: orders
        });

      } catch (error) {
        console.error('FOS process orders endpoint error:', error.message);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // FOS process orders TEST endpoint - for backend development
    // This is a test version of /fos-process-orders for development work
    // Once ready, the logic here can be transferred to the production endpoint
    app.post('/fos-process-orders', async (req, res) => {
      try {
        const { date, dev_mode, is_same_day, time_frame } = req.query;
        const { orderIds } = req.body;

        // Validate required parameters
        if (!date || !dev_mode || is_same_day === undefined) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameters: date, dev_mode, and is_same_day are all required',
            testEndpoint: true
          });
        }

        // Validate dev_mode is 6-digit binary
        const devModePattern = /^[01]{6}$/;
        if (!devModePattern.test(dev_mode)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid dev_mode parameter: must be exactly 6 binary digits (e.g., "000000" or "101010")',
            testEndpoint: true
          });
        }

        // Validate is_same_day is 0 or 1
        const isSameDayNum = parseInt(is_same_day);
        if (isSameDayNum !== 0 && isSameDayNum !== 1) {
          return res.status(400).json({
            success: false,
            error: 'Invalid is_same_day parameter: must be 0 or 1',
            testEndpoint: true
          });
        }

        // Validate date format (basic YYYY-MM-DD check)
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(date)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid date format: must be YYYY-MM-DD',
            testEndpoint: true
          });
        }

        // Validate orderIds exists and is a string
        if (!orderIds || typeof orderIds !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Invalid request body: must contain orderIds field with a string value',
            testEndpoint: true
          });
        }

        // Validate orderIds format (comma-separated numbers)
        const orderIdsPattern = /^\d+(,\d+)*$/;
        if (!orderIdsPattern.test(orderIds)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid orderIds format: must be comma-separated numbers (e.g., "123,234,345")',
            testEndpoint: true
          });
        }

        // Parse order IDs to array of integers
        const orderIdsArray = orderIds.split(',').map(id => parseInt(id.trim()));

        console.log(`\n[TEST] 🔧 === MANUAL ORDER PROCESSING REQUEST ===`);
        console.log(`[TEST] Date: ${date}`);
        console.log(`[TEST] Dev Mode: ${dev_mode}`);
        console.log(`[TEST] Is Same Day: ${is_same_day} (${isSameDayNum === 1 ? 'GoPeople' : 'AusPost'})`);
        console.log(`[TEST] Time Frame: ${time_frame || 'Not provided (will calculate automatically)'}`);
        console.log(`[TEST] Order IDs: ${orderIdsArray.join(', ')} (${orderIdsArray.length} orders)`);
        console.log(`[TEST] === END REQUEST INFO ===\n`);

        // Create manual request parameters for the pipeline
        const manualRequestParams = {
          date: date,
          dev_mode: dev_mode,
          is_same_day: String(isSameDayNum),
          orderIds: orderIdsArray,
          isManualProcessing: true,
          manualTimeframe: time_frame || null,
          // Add default parameters for pipeline compatibility
          locations: [],
          hasLocationFilter: false,
          store: '3',  // Both stores
          shop_ids: [10, 6],
          shop_id_filter: '10, 6'
        };

        // Execute the order processing pipeline
        const pipeline = new OrderProcessingPipeline(
          manualRequestParams,
          dbConfig,
          gopeopleConfig,
          auspostConfig,
          scriptsConfig
        );

        const response = await pipeline.execute();

        // Return the formatted response
        res.status(200).json(response);

      } catch (error) {
        console.error('[TEST] FOS process orders endpoint error:', error.message);
        res.status(500).json({
          success: false,
          testEndpoint: true,
          error: error.message
        });
      }
    });

    // Test endpoint for polaroid image processing
    app.get('/test-polaroid', async (req, res) => {
      try {
        const { order_number } = req.query;

        if (!order_number) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameter: order_number'
          });
        }

        console.log(`Test polaroid processing requested for order: ${order_number}`);

        const gdriveService = new GoogleDriveService();
        const result = await gdriveService.testPolaroidProcessing(order_number);

        res.status(200).json({
          success: result.success,
          testEndpoint: true,
          orderNumber: result.orderNumber,
          summary: result.summary || null,
          processedImages: result.processedImages || null,
          error: result.error || null,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Test polaroid endpoint error:', error.message);
        res.status(500).json({
          success: false,
          testEndpoint: true,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle unsupported methods
    app.all('*', (req, res) => {
      ErrorHandler.handleUnsupportedMethods(req, res);
    });
  }
}

module.exports = OrderProcessingRoutes;