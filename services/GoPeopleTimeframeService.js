const axios = require('axios');

class GoPeopleTimeframeService {
  constructor(apiTokenProd, apiTokenTest, timeframeApiUrl, devMode) {
    this.GOPEOPLE_API_TOKEN_PROD = apiTokenProd;
    this.GOPEOPLE_API_TOKEN_TEST = apiTokenTest;
    this.GOPEOPLE_TIMEFRAME_API_URL = timeframeApiUrl;
    this.devMode = devMode;

    // dev_mode[0] selects credentials (does NOT control API execution)
    // dev_mode[0] = '1' → Production credentials
    // dev_mode[0] = '0' → Test credentials
    // APIs always execute; dev_mode[0] only determines which environment to use
    const useProduction = devMode && devMode[0] === '1';
    this.GOPEOPLE_API_TOKEN = useProduction ? this.GOPEOPLE_API_TOKEN_PROD : this.GOPEOPLE_API_TOKEN_TEST;

    console.log(`\n🔑 === GOPEOPLE TIMEFRAME API CREDENTIALS SELECTION ===`);
    console.log(`dev_mode: ${devMode}`);
    console.log(`dev_mode[0]: ${devMode ? devMode[0] : 'N/A'}`);
    console.log(`Using ${useProduction ? 'PRODUCTION' : 'TEST'} credentials`);
    console.log(`Token configured: ${this.GOPEOPLE_API_TOKEN ? 'YES' : 'NO'}`);
    console.log(`=== END CREDENTIALS SELECTION ===\n`);
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
