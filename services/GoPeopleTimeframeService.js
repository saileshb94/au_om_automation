const axios = require('axios');
const { LOCATION_TIMEZONES } = require('../config');

class GoPeopleTimeframeService {
  constructor(apiTokenProd, apiTokenTest, timeframeApiUrlProd, timeframeApiUrlTest, devMode) {
    this.GOPEOPLE_API_TOKEN_PROD = apiTokenProd;
    this.GOPEOPLE_API_TOKEN_TEST = apiTokenTest;
    this.GOPEOPLE_TIMEFRAME_API_URL_PROD = timeframeApiUrlProd;
    this.GOPEOPLE_TIMEFRAME_API_URL_TEST = timeframeApiUrlTest;
    this.devMode = devMode;

    // IMPORTANT: Timeframe API ALWAYS uses PRODUCTION URL regardless of dev_mode[0]
    // Only credentials are selected based on dev_mode[0]
    this.GOPEOPLE_TIMEFRAME_API_URL = this.GOPEOPLE_TIMEFRAME_API_URL_PROD;

    // dev_mode[0] selects credentials (does NOT control API execution or URL)
    // dev_mode[0] = '1' → Production credentials
    // dev_mode[0] = '0' → Test credentials
    // APIs always execute; dev_mode[0] only determines which credentials to use
    const useProduction = devMode && devMode[0] === '1';
    this.GOPEOPLE_API_TOKEN = useProduction ? this.GOPEOPLE_API_TOKEN_PROD : this.GOPEOPLE_API_TOKEN_TEST;

    console.log(`\n🔑 === GOPEOPLE TIMEFRAME API CREDENTIALS & URL SELECTION ===`);
    console.log(`dev_mode: ${devMode}`);
    console.log(`dev_mode[0]: ${devMode ? devMode[0] : 'N/A'}`);
    console.log(`Using ${useProduction ? 'PRODUCTION' : 'TEST'} credentials`);
    console.log(`Token configured: ${this.GOPEOPLE_API_TOKEN ? 'YES' : 'NO'}`);
    console.log(`API URL: ${this.GOPEOPLE_TIMEFRAME_API_URL} (ALWAYS PRODUCTION)`);
    // console.log(`API_TOKEN: ${this.GOPEOPLE_API_TOKEN}`);
    console.log(`=== END CREDENTIALS & URL SELECTION ===\n`);

    // Location name mapping (suburb → city)
    this.locationMap = {
      'Moorabbin': 'Melbourne',
      'Alexandria': 'Sydney',
      'Moorooka': 'Brisbane',
      'Beulah Park': 'Adelaide',
      'Malaga': 'Perth'
    };
  }

  /**
   * Extract location name from title (removes Morning/Afternoon/Twilight suffix)
   * Examples: "Moorabbin Morning" → "Moorabbin", "Alexandria Twilight" → "Alexandria"
   */
  extractLocationFromTitle(title) {
    // Remove suffixes: Morning, Afternoon, Twilight
    return title.replace(/\s+(Morning|Afternoon|Twilight)$/i, '').trim();
  }

  /**
   * Map suburb name to city name for timezone lookup
   * Examples: "Moorabbin" → "Melbourne", "Alexandria" → "Sydney"
   */
  getCityFromLocation(locationName) {
    return this.locationMap[locationName] || null;
  }

  /**
   * Convert datetime from source timezone to target timezone
   * @param {string} dateTimeStr - DateTime string in format "YYYY-MM-DD HH:mm:ss±HHMM"
   * @param {string} targetTimezone - IANA timezone (e.g., "Australia/Melbourne")
   * @returns {string} - Converted datetime in format "YYYY-MM-DD HH:mm:ss±HHMM"
   */
  convertToLocalTimezone(dateTimeStr, targetTimezone) {
    try {
      // Parse the input datetime string
      // Format: "2025-10-27 11:30:00+1100"
      const match = dateTimeStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})([+-]\d{2})(\d{2})$/);
      if (!match) {
        console.warn(`⚠️ Invalid datetime format: ${dateTimeStr}`);
        return dateTimeStr;
      }

      const [, datePart, timePart, offsetHours, offsetMinutes] = match;
      const sourceOffset = `${offsetHours}:${offsetMinutes}`;

      // Create ISO 8601 string with timezone offset
      const isoString = `${datePart}T${timePart}${offsetHours}:${offsetMinutes}`;

      // Convert to target timezone using Intl API
      const date = new Date(isoString);

      // Format in target timezone
      const formatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: targetTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'longOffset'
      });

      const parts = formatter.formatToParts(date);
      const year = parts.find(p => p.type === 'year').value;
      const month = parts.find(p => p.type === 'month').value;
      const day = parts.find(p => p.type === 'day').value;
      const hour = parts.find(p => p.type === 'hour').value;
      const minute = parts.find(p => p.type === 'minute').value;
      const second = parts.find(p => p.type === 'second').value;
      const timeZoneName = parts.find(p => p.type === 'timeZoneName').value;

      // Parse offset from timeZoneName (e.g., "GMT+11:00" → "+1100")
      const offsetMatch = timeZoneName.match(/GMT([+-]\d{2}):(\d{2})/);
      const offset = offsetMatch ? `${offsetMatch[1]}${offsetMatch[2]}` : '+0000';

      return `${year}-${month}-${day} ${hour}:${minute}:${second}${offset}`;
    } catch (error) {
      console.error(`❌ Error converting timezone for ${dateTimeStr}:`, error.message);
      return dateTimeStr;
    }
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

      // Process results: clean titles, convert timezones, deduplicate, and sort
      let processedData = response.data;
      if (response.data.result && Array.isArray(response.data.result)) {
        const originalCount = response.data.result.length;

        // Step 1: Clean titles and convert timezones
        const processedResults = response.data.result.map(item => {
          const locationName = this.extractLocationFromTitle(item.title);
          const cityName = this.getCityFromLocation(locationName);

          if (!cityName) {
            console.warn(`⚠️ Unknown location: ${locationName} (from title: ${item.title})`);
            return { ...item, title: locationName };
          }

          const timezoneConfig = LOCATION_TIMEZONES[cityName];
          if (!timezoneConfig) {
            console.warn(`⚠️ No timezone config for city: ${cityName}`);
            return { ...item, title: locationName };
          }

          // Convert datetime to local timezone
          const localDateTime = this.convertToLocalTimezone(item.dateTime, timezoneConfig.timezone);

          return {
            ...item,
            title: locationName,
            dateTime: localDateTime
          };
        });

        // Step 2: Deduplicate by location + dateTime combination
        const seen = new Set();
        const uniqueResults = processedResults.filter(item => {
          const key = `${item.title}|${item.dateTime}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });

        // Step 3: Sort by title (alphabetically), then by dateTime (chronologically)
        const sortedResults = uniqueResults.sort((a, b) => {
          // First sort by title
          const titleCompare = a.title.localeCompare(b.title);
          if (titleCompare !== 0) return titleCompare;

          // Then sort by dateTime
          return a.dateTime.localeCompare(b.dateTime);
        });

        const uniqueCount = sortedResults.length;
        const duplicatesRemoved = originalCount - uniqueCount;

        processedData = {
          ...response.data,
          result: sortedResults
        };

        console.log(`\n🔧 === PROCESSING SUMMARY ===`);
        console.log(`Original entries: ${originalCount}`);
        console.log(`After timezone conversion & title cleanup: ${processedResults.length}`);
        console.log(`After deduplication: ${uniqueCount}`);
        console.log(`Duplicates removed: ${duplicatesRemoved}`);
        console.log(`Final sorted entries: ${sortedResults.length}`);
        console.log(`=== END PROCESSING SUMMARY ===\n`);
      }

      return {
        success: true,
        data: processedData
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
