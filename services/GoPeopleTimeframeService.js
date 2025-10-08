const axios = require('axios');

class GoPeopleTimeframeService {
  constructor(apiToken, timeframeApiUrl) {
    this.GOPEOPLE_API_TOKEN = apiToken;
    this.GOPEOPLE_TIMEFRAME_API_URL = timeframeApiUrl;
  }

  async getShiftTimeframe(dateStart, dateEnd) {
    try {
      console.log(`\n🚀 === GOPEOPLE TIMEFRAME API REQUEST ===`);
      console.log(`API URL: ${this.GOPEOPLE_TIMEFRAME_API_URL}`);
      console.log(`Date Start: ${dateStart}`);
      console.log(`Date End: ${dateEnd}`);
      console.log(`=== END GOPEOPLE TIMEFRAME API REQUEST ===\n`);

      const response = await axios.get(
        this.GOPEOPLE_TIMEFRAME_API_URL,
        {
          params: {
            dateStart: dateStart,
            dateEnd: dateEnd
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `bearer ${this.GOPEOPLE_API_TOKEN}`
          },
          timeout: 5000 // 5 second timeout
        }
      );

      console.log(`\n✅ === GOPEOPLE TIMEFRAME API RESPONSE ===`);
      console.log(`HTTP Status: ${response.status}`);
      console.log(`Response Data:`, JSON.stringify(response.data, null, 2));
      console.log(`=== END GOPEOPLE TIMEFRAME API RESPONSE ===\n`);

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.log(`\n❌ === GOPEOPLE TIMEFRAME API ERROR ===`);
      console.log(`Error Type: ${error.name || 'Unknown'}`);
      console.log(`Error Message: ${error.message}`);
      if (error.response) {
        console.log(`HTTP Status: ${error.response.status}`);
        console.log(`Response Data:`, JSON.stringify(error.response.data, null, 2));
      }
      if (error.code) {
        console.log(`Error Code: ${error.code}`);
      }
      console.log(`=== END GOPEOPLE TIMEFRAME API ERROR ===\n`);

      return {
        success: false,
        error: error.message,
        statusCode: error.response?.status,
        data: error.response?.data || null
      };
    }
  }
}

module.exports = GoPeopleTimeframeService;
