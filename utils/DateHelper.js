class DateHelper {
  static getMelbourneDate() {
    const now = new Date();
    const melbourneTime = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Melbourne"}));
    return melbourneTime.toISOString().split('T')[0];
  }

  static formatDate(dateInput) {
    if (!dateInput) return DateHelper.getMelbourneDate();
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }
    
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date format: ${dateInput}, using today's date`);
        return DateHelper.getMelbourneDate();
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.warn(`Date parsing error: ${error.message}, using today's date`);
      return DateHelper.getMelbourneDate();
    }
  }
}

module.exports = DateHelper;