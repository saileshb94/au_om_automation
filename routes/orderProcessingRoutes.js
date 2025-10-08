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