/**
 * Configuration file for various modules
 * Contains constants and settings used across different scripts
 */

// ============================================================================
// GOPEOPLE MODULE CONFIGURATION
// ============================================================================

/**
 * GoPeople API URL
 */
const GOPEOPLE_API_URL = 'http://api-demo.gopeople.com.au/book/instant';

/**
 * GoPeople Timeframe API URL
 * Used to query shift availability within a date range
 */
const GOPEOPLE_TIMEFRAME_API_URL = 'http://api-demo.gopeople.com.au/shift';

/**
 * Location-based warehouse/pickup addresses for GoPeople API
 * These are the "addressFrom" locations for each fulfillment center
 */
const LOCATION_ADDRESSES = {
  'Melbourne': {
    unit: "",
    address1: "Or 15 Cochranes Road (from Entrance) After 5pm Or On Weekends As Gate Is Locked Clik Collective - Loading Dock Sullivan And Ebden Street",
    suburb: "MOORABBIN",
    state: "VIC",
    postcode: "3189",
    isCommercial: true,
    companyName: "Lvly Melbourne",
    contacts: [{
      contactName: "Lvly",
      contactNumber: "0390710475",
      sendUpdateSMS: false,
      contactEmail: "",
      sendUpdateEmail: false
    }]
  },
  'Sydney': {
    unit: "Unit 1",
    address1: "22-28 Mandible St", // TODO: Replace with actual address
    suburb: "Alexandria",
    state: "NSW",
    postcode: "2015",
    isCommercial: true,
    companyName: "Lvly Sydney",
    contacts: [{
      contactName: "Lvly",
      contactNumber: "0390710475", // TODO: Replace with actual number
      sendUpdateSMS: false,
      contactEmail: "",
      sendUpdateEmail: false
    }]
  },
  'Perth': {
    unit: "4",
    address1: "35 Colin Jamieson Dr", // TODO: Replace with actual address
    suburb: "Welshpool",
    state: "WA",
    postcode: "6106",
    isCommercial: true,
    companyName: "Lvly Perth",
    contacts: [{
      contactName: "Lvly",
      contactNumber: "0390712481", // TODO: Replace with actual number
      sendUpdateSMS: false,
      contactEmail: "",
      sendUpdateEmail: false
    }]
  },
  'Adelaide': {
    unit: "",
    address1: "295 The Parade", // TODO: Replace with actual address
    suburb: "Beulah Park",
    state: "SA",
    postcode: "5067",
    isCommercial: true,
    companyName: "Lvly Adelaide",
    contacts: [{
      contactName: "Lvly",
      contactNumber: "0390712481", // TODO: Replace with actual number
      sendUpdateSMS: false,
      contactEmail: "",
      sendUpdateEmail: false
    }]
  },
  'Brisbane': {
    unit: "2",
    address1: "25 Unwin St", // TODO: Replace with actual address
    suburb: "Moorooka",
    state: "QLD",
    postcode: "4105",
    isCommercial: true,
    companyName: "Lvly Brisbane",
    contacts: [{
      contactName: "Lvly",
      contactNumber: "0390710475", // TODO: Replace with actual number
      sendUpdateSMS: false,
      contactEmail: "",
      sendUpdateEmail: false
    }]
  }
};

/**
 * Timezone configuration for each location
 * Used to calculate correct pickup times for GoPeople API
 * Note: Daylight savings periods:
 * - VIC, NSW, SA: First Sunday in October to First Sunday in April
 * - QLD, WA: No daylight savings
 */
const LOCATION_TIMEZONES = {
  'Melbourne': { 
    offset: '+1100', // AEDT (daylight savings)
    offsetStandard: '+1000', // AEST (standard time)
    timezone: 'Australia/Melbourne',
    hasDaylightSavings: true
  },
  'Sydney': { 
    offset: '+1100', // AEDT (daylight savings)
    offsetStandard: '+1000', // AEST (standard time)
    timezone: 'Australia/Sydney',
    hasDaylightSavings: true
  },
  'Brisbane': { 
    offset: '+1000', // AEST (no daylight savings)
    offsetStandard: '+1000',
    timezone: 'Australia/Brisbane',
    hasDaylightSavings: false
  },
  'Adelaide': { 
    offset: '+1030', // ACDT (daylight savings)
    offsetStandard: '+0930', // ACST (standard time)
    timezone: 'Australia/Adelaide',
    hasDaylightSavings: true
  },
  'Perth': { 
    offset: '+0800', // AWST (no daylight savings)
    offsetStandard: '+0800',
    timezone: 'Australia/Perth',
    hasDaylightSavings: false
  }
};

/**
 * Pickup time slots configuration for each location and day
 * Orders are assigned to the next available slot based on cutoff times
 * If current time > last slot cutoff, the order cannot be processed for same-day delivery
 */
const PICKUP_TIME_RULES = {
  'Melbourne': {
    'Monday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Tuesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Wednesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Thursday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Friday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Saturday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Sunday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    }
  },
  'Sydney': {
    'Monday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Tuesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Wednesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Thursday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Friday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Saturday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Sunday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    }
  },
  'Brisbane': {
    'Monday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Tuesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Wednesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Thursday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Friday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Saturday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Sunday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    }
  },
  'Adelaide': {
    'Monday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Tuesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Wednesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Thursday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Friday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Saturday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Sunday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    }
  },
  'Perth': {
    'Monday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Tuesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Wednesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Thursday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Friday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:00' },
        { pickupTime: '14:30', cutoffTime: '14:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Saturday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    },
    'Sunday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:00' },
        { pickupTime: '16:30', cutoffTime: '16:00' }
      ]
    }
  }
};

/**
 * Default parcel configuration for GoPeople API
 * These are the standard dimensions and weight for all packages
 */
const GOPEOPLE_PARCEL_DEFAULTS = {
  type: 'custom',
  number: 1,
  width: 10,  // cm
  height: 10, // cm
  length: 10, // cm
  weight: 5   // kg
};

/**
 * GoPeople API default settings
 * Standard values used for all deliveries unless specified otherwise
 */
const GOPEOPLE_DELIVERY_DEFAULTS = {
  description: 'Giftbox',           // Default package description
  atl: true,                        // Authority to leave
  idCheckRequired: false,           // ID check requirement
  sendUpdateSMS: false,             // SMS notifications for recipient
  sendUpdateEmail: false,           // Email notifications for recipient
  refPrefix: 'LV',                  // Prefix for reference numbers
  ref2: '',                         // Secondary reference (usually empty)
  collectPointId: ''                // Collection point ID (usually empty)
};

// ============================================================================
// AUSPOST MODULE CONFIGURATION
// ============================================================================

/**
 * Location-based warehouse/pickup addresses for Auspost API
 * Temporarily using same addresses as GoPeople (to be updated later)
 */
const AUSPOST_LOCATION_ADDRESSES = {
  'Melbourne': {
    name: "Lvly Melbourne",
    lines: ["Or 15 Cochranes Road (from Entrance) "],
    suburb: "MOORABBIN",
    state: "VIC",
    postcode: "3189",
    phone: "0390710475",
    email: "melbourne@lvly.com.au"
  },
  'Sydney': {
    name: "Lvly Sydney",
    lines: ["Unit 1, 22-28 Mandible St"],
    suburb: "Alexandria",
    state: "NSW",
    postcode: "2015",
    phone: "0390710475",
    email: "sydney@lvly.com.au"
  },
  'Perth': {
    name: "Lvly Perth",
    lines: ["4, 35 Colin Jamieson Dr"],
    suburb: "Welshpool",
    state: "WA",
    postcode: "6106",
    phone: "0390712481",
    email: "perth@lvly.com.au"
  },
  'Adelaide': {
    name: "Lvly Adelaide",
    lines: ["295 The Parade"],
    suburb: "Beulah Park",
    state: "SA",
    postcode: "5067",
    phone: "0390712481",
    email: "adelaide@lvly.com.au"
  },
  'Brisbane': {
    name: "Lvly Brisbane",
    lines: ["2, 25 Unwin St"],
    suburb: "Moorooka",
    state: "QLD",
    postcode: "4105",
    phone: "0390710475",
    email: "brisbane@lvly.com.au"
  }
};

/**
 * Auspost cutoff time rules - simplified version
 * Single cutoff time per day for each location
 * Format: { 'Location': { 'DayOfWeek': { cutoffTime: 'HH:MM', enabled: true/false } } }
 */
const AUSPOST_CUTOFF_RULES = {
  'Melbourne': {
    'Monday': { cutoffTime: '16:00', enabled: true },
    'Tuesday': { cutoffTime: '16:00', enabled: true },
    'Wednesday': { cutoffTime: '16:00', enabled: true },
    'Thursday': { cutoffTime: '16:00', enabled: true },
    'Friday': { cutoffTime: '16:00', enabled: true },
    'Saturday': { cutoffTime: '13:00', enabled: true },
    'Sunday': { cutoffTime: '13:00', enabled: true }
  },
  'Sydney': {
    'Monday': { cutoffTime: '16:00', enabled: true },
    'Tuesday': { cutoffTime: '16:00', enabled: true },
    'Wednesday': { cutoffTime: '16:00', enabled: true },
    'Thursday': { cutoffTime: '16:00', enabled: true },
    'Friday': { cutoffTime: '16:00', enabled: true },
    'Saturday': { cutoffTime: '13:00', enabled: true },
    'Sunday': { cutoffTime: '13:00', enabled: true }
  },
  'Brisbane': {
    'Monday': { cutoffTime: '16:00', enabled: true },
    'Tuesday': { cutoffTime: '16:00', enabled: true },
    'Wednesday': { cutoffTime: '16:00', enabled: true },
    'Thursday': { cutoffTime: '16:00', enabled: true },
    'Friday': { cutoffTime: '16:00', enabled: true },
    'Saturday': { cutoffTime: '13:00', enabled: true },
    'Sunday': { cutoffTime: '13:00', enabled: true }
  },
  'Adelaide': {
    'Monday': { cutoffTime: '16:00', enabled: true },
    'Tuesday': { cutoffTime: '16:00', enabled: true },
    'Wednesday': { cutoffTime: '16:00', enabled: true },
    'Thursday': { cutoffTime: '16:00', enabled: true },
    'Friday': { cutoffTime: '16:00', enabled: true },
    'Saturday': { cutoffTime: '13:00', enabled: true },
    'Sunday': { cutoffTime: '13:00', enabled: true }
  },
  'Perth': {
    'Monday': { cutoffTime: '16:00', enabled: true },
    'Tuesday': { cutoffTime: '16:00', enabled: true },
    'Wednesday': { cutoffTime: '16:00', enabled: true },
    'Thursday': { cutoffTime: '16:00', enabled: true },
    'Friday': { cutoffTime: '16:00', enabled: true },
    'Saturday': { cutoffTime: '13:00', enabled: true },
    'Sunday': { cutoffTime: '13:00', enabled: true }
  }
};

/**
 * Auspost shipment defaults
 * Hardcoded values for all Auspost API shipment items
 */
const AUSPOST_SHIPMENT_DEFAULTS = {
  product_id: "FPP",
  packaging_type: "CTN",
  length: "40",
  height: "15",
  width: "15",
  weight: "3",
  authority_to_leave: true,
  allow_partial_delivery: false
};

/**
 * Auspost API Credentials Configuration
 * Separate credentials for LVLY (shop_id=10) and Bloomeroo (shop_id=6)
 * Account numbers are location-specific
 */
const AUSPOST_CREDENTIALS = {
  LVLY: {
    url: 'https://digitalapi.auspost.com.au/test/shipping/v1/shipments',
    accountNumbers: {
      'Melbourne': '01416548',
      'Sydney': '01416548',
      'Perth': '01416548',
      'Adelaide': '01416548',
      'Brisbane': '01416548'
    },
    authorization: process.env.AUSPOST_AUTHORIZATION
  },
  BLOOMEROO: {
    url: 'https://digitalapi.auspost.com.au/test/shipping/v1/shipments',
    accountNumbers: {
      'Melbourne': '01416548',
      'Sydney': '01416548',
      'Perth': '01416548',
      'Adelaide': '01416548',
      'Brisbane': '01416548'
    },
    authorization: process.env.AUSPOST_BL_AUTHORIZATION || process.env.AUSPOST_AUTHORIZATION
  }
};

// ============================================================================
// OTHER MODULE CONFIGURATIONS (if needed in future)
// ============================================================================

const GOOGLE_DRIVE_CONFIG = {
  mainFolderId: '1BvQbt9FESO-If8GC4qoix6Gp3utwd-Me', // This should be the Shared Drive ID
  credentialsJson: process.env.GOOGLE_DRIVE_CREDENTIALS_JSON,
  imageSettings: {
    downloadTimeout: 30000,
    maxFileSize: 10 * 1024 * 1024, // 10MB limit
    supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif'],
    batchProcessingSize: 3, // Process 3 images at a time
    batchDelay: 1000, // 1 second delay between batches
    useStreaming: true
  }
};

/**
 * Personalized Packing Notes API Configuration
 * API endpoints for processing different types of personalized data
 */
const PERSONALIZED_API_CONFIG = {
  baseUrl: 'https://limitless.docupilot.app/dashboard/documents/create',
  apiKey: process.env.PERSONALIZED_API_KEY,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  endpoints: {
    jars_luxe: {
      url: '/ac919e50/474c90b5',
      method: 'POST',
      description: 'Process luxe jar personalization data'
    },
    jars_classic_large: {
      url: '/ac919e50/fed759df',
      method: 'POST',
      description: 'Process classic large jar personalization data'
    },
    prosecco: {
      url: '/ac919e50/414e6c2e',
      method: 'POST',
      description: 'Process prosecco data'
    },
    packing_slips: {
      url: '/ac919e50/04e72138',
      method: 'POST',
      description: 'Process packing slip data'
    },
    message_cards: {
      url: '/ac919e50/babd4a32',
      method: 'POST',
      description: 'Process message card data'
    },
    candles: {
      url: '/ac919e50/7ec2e86f',
      method: 'POST',
      description: 'Process candles data'
    }
  }
};

/**
 * GoPeople Labels API Configuration
 * API endpoint for processing GoPeople label data from successful orders
 */
const GP_LABELS_API_CONFIG = {
  baseUrl: 'https://limitless.docupilot.app/dashboard/documents/create',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  endpoint: {
    url: '/ac919e50/944bc033',
    method: 'POST',
    description: 'Process GoPeople label data for printing'
  }
};

/**
 * AusPost Labels API Configuration
 * API endpoint for processing AusPost label data from successful orders
 */
const AUSPOST_LABELS_API_CONFIG = {
  baseUrl: 'https://limitless.docupilot.app/dashboard/documents/create',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  endpoint: {
    url: '/ac919e50/252252e5',
    method: 'POST',
    description: 'Process AusPost label data for printing'
  }
};

/**
 * Google Sheets Configuration
 * Configuration for writing order tracking data to Google Sheets
 * The spreadsheet ID can be found in the Google Sheets URL:
 * https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
 */
const GOOGLE_SHEETS_CONFIG = {
  spreadsheetId: '1GvAVW4TzWgqovb3KhwEl2XX9RXmufF2JuNyB8eJCFQg',
  sheetName: 'Orders', // The name of the tab/sheet to write to
  // Column headers and order of fields to write
  columns: [
    'store',
    'order_number',
    'delivery_date',
    'location',
    'is_same_day',
    'batch',
    'gopeople_status',
    'gopeople_error',
    'auspost_status',
    'auspost_error',
    'personalized_status',
    'packing_slip_status',
    'message_cards_status',
    'updateProcessingStatus',
    'order_products',
    'timestamp'
  ],
  // Batches sheet configuration
  batchesSheetName: 'Batches', // The name of the batch details sheet
  batchesColumns: [
    'store',
    'delivery_date',
    'city',
    'same_day',
    'batch',
    'count_success_orders',
    'orders',
    'failed_orders',
    'timestamp'
  ]
};


// Export all configurations
module.exports = {
  // GoPeople module exports
  GOPEOPLE_API_URL,
  GOPEOPLE_TIMEFRAME_API_URL,
  LOCATION_ADDRESSES,
  LOCATION_TIMEZONES,
  GOPEOPLE_PARCEL_DEFAULTS,
  GOPEOPLE_DELIVERY_DEFAULTS,
  PICKUP_TIME_RULES,
  // Auspost module exports
  AUSPOST_LOCATION_ADDRESSES,
  AUSPOST_CUTOFF_RULES,
  AUSPOST_SHIPMENT_DEFAULTS,
  AUSPOST_CREDENTIALS,
  // Other exports
  GOOGLE_DRIVE_CONFIG,
  PERSONALIZED_API_CONFIG,
  GP_LABELS_API_CONFIG,
  AUSPOST_LABELS_API_CONFIG,
  GOOGLE_SHEETS_CONFIG
};