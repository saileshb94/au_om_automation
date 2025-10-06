class ErrorHandler {
  static handle(error, res) {
    console.error('Overall function error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  static handleUnsupportedMethods(req, res) {
    if (req.method !== 'GET') {
      res.status(405).json({
        error: 'Method not allowed',
        allowedMethods: ['GET', 'OPTIONS']
      });
    } else {
      res.status(404).json({
        error: 'Not found'
      });
    }
  }
}

module.exports = ErrorHandler;