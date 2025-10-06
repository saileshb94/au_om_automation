// Timezone utilities for GoPeople API
const { LOCATION_TIMEZONES } = require('../config');

class TimezoneHelper {
  static getTimezoneOffset(location, date) {
    const locationTz = LOCATION_TIMEZONES[location];
    if (!locationTz) return '+1000'; // Default to AEST
    
    // For locations without daylight savings, return the standard offset
    if (!locationTz.hasDaylightSavings) {
      return locationTz.offset;
    }
    
    // For locations with daylight savings (Melbourne, Sydney, Adelaide)
    const dateObj = new Date(date);
    const month = dateObj.getMonth() + 1; // getMonth() returns 0-11
    
    // Daylight savings in Australia typically runs from first Sunday in October to first Sunday in April
    // This is a simplified check - for production, consider using a proper timezone library
    const isDaylightSavings = month >= 10 || month <= 3;
    
    // Return appropriate offset based on daylight savings period
    return isDaylightSavings ? locationTz.offset : locationTz.offsetStandard;
  }

  static getLocationTime(location) {
    const locationTz = LOCATION_TIMEZONES[location];
    if (!locationTz) {
      console.error(`No timezone info for location: ${location}`);
      return null;
    }
    
    const now = new Date();
    return new Date(now.toLocaleString("en-US", { timeZone: locationTz.timezone }));
  }

  static formatTimeString(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

module.exports = TimezoneHelper;