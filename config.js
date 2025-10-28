/**
 * Configuration file for various modules
 * Contains constants and settings used across different scripts
 */

// ============================================================================
// GOPEOPLE MODULE CONFIGURATION
// ============================================================================

/**
 * GoPeople API URLs - Production and Test
 * dev_mode[0] = '1' → Production
 * dev_mode[0] = '0' → Test
 */
const GOPEOPLE_API_URL_PROD = 'https://api.gopeople.com.au/book/instant';
const GOPEOPLE_API_URL_TEST = 'http://api-demo.gopeople.com.au/book/instant';

/**
 * GoPeople Timeframe API URLs - Production and Test
 * Used to query shift availability within a date range
 * Note: Timeframe always uses production regardless of dev_mode[0]
 */
const GOPEOPLE_TIMEFRAME_API_URL_PROD = 'https://api.gopeople.com.au/shift';
const GOPEOPLE_TIMEFRAME_API_URL_TEST = 'http://api-demo.gopeople.com.au/shift';

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
    unit: "1",
    address1: "27 Townsend St", // TODO: Replace with actual address
    suburb: "Malaga",
    state: "WA",
    postcode: "6090",
    isCommercial: true,
    companyName: "Lvly Perth",
    contacts: [{
      contactName: "Lvly",
      contactNumber: "0390710475", // TODO: Replace with actual number
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
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Tuesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Wednesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Thursday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Friday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Saturday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Sunday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    }
  },
  'Sydney': {
    'Monday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Tuesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Wednesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Thursday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Friday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Saturday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Sunday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    }
  },
  'Brisbane': {
    'Monday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Tuesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Wednesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Thursday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Friday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Saturday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Sunday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    }
  },
  'Adelaide': {
    'Monday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Tuesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Wednesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Thursday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Friday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Saturday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Sunday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    }
  },
  'Perth': {
    'Monday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Tuesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Wednesday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Thursday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Friday': {
      slots: [
        { pickupTime: '11:30', cutoffTime: '11:15' },
        { pickupTime: '14:30', cutoffTime: '14:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Saturday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
      ]
    },
    'Sunday': {
      slots: [
        { pickupTime: '13:30', cutoffTime: '13:15' },
        { pickupTime: '16:30', cutoffTime: '16:15' }
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
 * Separate address sets for LVLY (shop_id=10) and Bloomeroo (shop_id=6)
 * Brand is selected based on order's shop_id in the auspost script
 */
const AUSPOST_LOCATION_ADDRESSES = {
  LVLY: {
    'Melbourne': {
      name: "Lvly Melbourne",
      lines: ["15 COCHRANES RD"],
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
      lines: ["1, 27 Townsend St"],
      suburb: "Malaga",
      state: "WA",
      postcode: "6090",
      phone: "0390710475",
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
  },
  BLOOMEROO: {
    'Melbourne': {
      name: "Bloomeroo Melbourne",
      lines: ["15 COCHRANES RD"],  // TODO: Update with actual Bloomeroo addresses
      suburb: "MOORABBIN",
      state: "VIC",
      postcode: "3189",
      phone: "0272598209",
      email: "melbourne@lvly.com.au"
    },
    'Sydney': {
      name: "Bloomeroo Sydney",
      lines: ["Unit 1, 22-28 Mandible St"],  // TODO: Update with actual Bloomeroo addresses
      suburb: "Alexandria",
      state: "NSW",
      postcode: "2015",
      phone: "0272598209",
      email: "sydney@lvly.com.au"
    },
    'Perth': {
      name: "Bloomeroo Perth",
      lines: ["1, 27 Townsend St"],
      suburb: "Malaga",
      state: "WA",
      postcode: "6090",
      phone: "0272598209",
      email: "perth@lvly.com.au"
    },
    'Adelaide': {
      name: "Bloomeroo Adelaide",
      lines: ["295 The Parade"],  // TODO: Update with actual Bloomeroo addresses
      suburb: "Beulah Park",
      state: "SA",
      postcode: "5067",
      phone: "0390712481",
      email: "adelaide@lvly.com.au"
    },
    'Brisbane': {
      name: "Bloomeroo Brisbane",
      lines: ["2, 25 Unwin St"],  // TODO: Update with actual Bloomeroo addresses
      suburb: "Moorooka",
      state: "QLD",
      postcode: "4105",
      phone: "0272598209",
      email: "brisbane@lvly.com.au"
    }
  }
};

/**
 * Auspost cutoff time rules - simplified version
 * Single cutoff time per day for each location
 * Format: { 'Location': { 'DayOfWeek': { cutoffTime: 'HH:MM', enabled: true/false } } }
 */
const AUSPOST_CUTOFF_RULES = {
  'Melbourne': {
    'Monday': { cutoffTime: '17:00', enabled: true },
    'Tuesday': { cutoffTime: '17:00', enabled: true },
    'Wednesday': { cutoffTime: '17:00', enabled: true },
    'Thursday': { cutoffTime: '17:00', enabled: true },
    'Friday': { cutoffTime: '17:00', enabled: true },
    'Saturday': { cutoffTime: '17:00', enabled: true },
    'Sunday': { cutoffTime: '17:00', enabled: true }
  },
  'Sydney': {
    'Monday': { cutoffTime: '17:00', enabled: true },
    'Tuesday': { cutoffTime: '17:00', enabled: true },
    'Wednesday': { cutoffTime: '17:00', enabled: true },
    'Thursday': { cutoffTime: '17:00', enabled: true },
    'Friday': { cutoffTime: '17:00', enabled: true },
    'Saturday': { cutoffTime: '17:00', enabled: true },
    'Sunday': { cutoffTime: '17:00', enabled: true }
  },
  'Brisbane': {
    'Monday': { cutoffTime: '17:00', enabled: true },
    'Tuesday': { cutoffTime: '17:00', enabled: true },
    'Wednesday': { cutoffTime: '17:00', enabled: true },
    'Thursday': { cutoffTime: '17:00', enabled: true },
    'Friday': { cutoffTime: '17:00', enabled: true },
    'Saturday': { cutoffTime: '17:00', enabled: true },
    'Sunday': { cutoffTime: '17:00', enabled: true }
  },
  'Adelaide': {
    'Monday': { cutoffTime: '17:00', enabled: true },
    'Tuesday': { cutoffTime: '17:00', enabled: true },
    'Wednesday': { cutoffTime: '17:00', enabled: true },
    'Thursday': { cutoffTime: '17:00', enabled: true },
    'Friday': { cutoffTime: '17:00', enabled: true },
    'Saturday': { cutoffTime: '17:00', enabled: true },
    'Sunday': { cutoffTime: '17:00', enabled: true }
  },
  'Perth': {
    'Monday': { cutoffTime: '17:00', enabled: true },
    'Tuesday': { cutoffTime: '17:00', enabled: true },
    'Wednesday': { cutoffTime: '17:00', enabled: true },
    'Thursday': { cutoffTime: '17:00', enabled: true },
    'Friday': { cutoffTime: '17:00', enabled: true },
    'Saturday': { cutoffTime: '17:00', enabled: true },
    'Sunday': { cutoffTime: '17:00', enabled: true }
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
 * AusPost Labels API Configuration
 * Configuration for generating labels from successful shipments
 * Uses the new AusPost Labels API endpoint with minimal payload
 * Separate URLs for production and test based on dev_mode[0]
 * - dev_mode[0] = '1' → Production (apiUrl_prod)
 * - dev_mode[0] = '0' → Test (apiUrl_test)
 */
const AUSPOST_LABELS_CONFIG = {
  apiUrl_prod: 'https://digitalapi.auspost.com.au/shipping/v1/labels',
  apiUrl_test: 'https://digitalapi.auspost.com.au/test/shipping/v1/labels',
  wait_for_label_url: true,
  unlabelled_articles_only: false,
  preferences: [
    {
      type: "PRINT",
      groups: [
        {
          group: "StarTrack",
          layout: "A4-4pp",
          branded: true,
          left_offset: 0,
          top_offset: 0
        }
      ]
    }
  ],
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000
};

/**
 * Auspost API Credentials Configuration
 * Separate credentials for LVLY (shop_id=10) and Bloomeroo (shop_id=6)
 * URLs, account numbers, and authorization are all separated for prod/test
 *
 * Credential selection based on dev_mode[0]:
 * - dev_mode[0] = '1' → Production (url_prod, accountNumbers_prod, authorization_prod)
 * - dev_mode[0] = '0' → Test (url_test, accountNumbers_test, authorization_test)
 *
 * Note: dev_mode[0] only selects credentials. APIs always execute if orders are available.
 */
const AUSPOST_CREDENTIALS = {
  LVLY: {
    url_prod: 'https://digitalapi.auspost.com.au/shipping/v1/shipments',
    url_test: 'https://digitalapi.auspost.com.au/test/shipping/v1/shipments',
    accountNumbers_prod: {
      'Melbourne': '10150258',  // TODO: Replace with actual production account numbers
      'Sydney': '10158358',
      'Perth': '10169260',
      'Adelaide': '10177847',
      'Brisbane': '10166223'
    },
    accountNumbers_test: {
      'Melbourne': '01416548',
      'Sydney': '01416548',
      'Perth': '01416548',
      'Adelaide': '01416548',
      'Brisbane': '01416548'
    },
    authorization_prod: process.env.AUSPOST_AUTHORIZATION_PROD,
    authorization_test: process.env.AUSPOST_AUTHORIZATION_TEST
  },
  BLOOMEROO: {
    url_prod: 'https://digitalapi.auspost.com.au/shipping/v1/shipments',
    url_test: 'https://digitalapi.auspost.com.au/test/shipping/v1/shipments',
    accountNumbers_prod: {
      'Melbourne': '10173537',  // TODO: Replace with actual production account numbers
      'Sydney': '10173538',
      'Perth': '10173540',
      'Adelaide': '10177848',
      'Brisbane': '10173539'
    },
    accountNumbers_test: {
      'Melbourne': '01416548',
      'Sydney': '01416548',
      'Perth': '01416548',
      'Adelaide': '01416548',
      'Brisbane': '01416548'
    },
    authorization_prod: process.env.AUSPOST_BL_AUTHORIZATION_PROD || process.env.AUSPOST_AUTHORIZATION_PROD,
    authorization_test: process.env.AUSPOST_BL_AUTHORIZATION_TEST || process.env.AUSPOST_AUTHORIZATION_TEST
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
 * Product Tally API Configuration
 * API endpoint for submitting product count tallies per location
 */
const PRODUCT_TALLY_API_CONFIG = {
  baseUrl: 'https://limitless.docupilot.app/dashboard/documents/create',
  endpoint: {
    url: '/ac919e50/58ae12ab',
    method: 'POST'
  },
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};

/**
 * Product Tally Rules Configuration
 * Defines tables and rows for product counting based on text matching
 *
 * Structure:
 * - Each table has a name and multiple rows
 * - Each row has a type: 'simple' or 'complex'
 *
 * Simple Row (label → single value):
 *   {
 *     type: 'simple',
 *     label: 'Field_Name',           // Becomes key in API payload
 *     searchTexts: ['text1', 'text2'] // OR logic: matches ANY text (case-insensitive substring)
 *   }
 *   Output: { Field_Name: 5 }
 *
 * Complex Row (label → nested object with multiple fields):
 *   {
 *     type: 'complex',
 *     label: 'Category_Name',         // Becomes parent key in API payload
 *     fields: [
 *       {
 *         fieldName: 'SubField1',     // Becomes nested key
 *         searchTexts: ['text1']      // OR logic: matches ANY text (case-insensitive substring)
 *       },
 *       {
 *         fieldName: 'SubField2',
 *         searchTexts: ['text2', 'text3']
 *       }
 *     ]
 *   }
 *   Output: { Category_Name: { SubField1: 3, SubField2: 7 } }
 *
 * searchTexts Logic:
 * - OR logic: Product matches if it contains ANY of the search texts
 * - Case-insensitive substring matching
 * - Count is the sum of product quantities that match
 *
 * Example API Payload:
 * {
 *   location: 'Melbourne',
 *   date: '2025-10-12',
 *   batch: 5,
 *   tables: [
 *     {
 *       Products_Table: {
 *         Luxe_Products: 8,      // Simple row
 *         Large: 8,              // Simple row
 *         Candle: {              // Complex row
 *           Small: 1,
 *           Medium: 2,
 *           Large: 3
 *         }
 *       }
 *     }
 *   ]
 * }
 */
const PRODUCT_TALLY_RULES = {
  tables: [
    {
      name: 'table_1',
      rows: [
        {
          type: 'simple',
          label: 'fancy_pants',
          searchTexts: ['fancy pants','so fancy']
        },
        {
          type: 'simple',
          label: 'just_peachy',
          searchTexts: ['just peachy','honeybun']
        },
        {
          type: 'simple',
          label: 'timeless_classic',
          searchTexts: ['timeless','white condolence flowers','simply stunning']
        },
        {
          type: 'simple',
          label: 'blushing_beauty',
          searchTexts: ['blushing beauty','forever love','seasonal condolence flowers','blush & bloom']
        },
        {
          type: 'simple',
          label: 'sunshine',
          searchTexts: ['sunshine']
        },
        {
          type: 'simple',
          label: 'coral_cutie',
          searchTexts: ['coral cutie','cherish you']
        },
        {
          type: 'simple',
          label: 'mini_dried',
          searchTexts: ['mini dried']
        },
        {
          type: 'simple',
          label: 'medium_dried',
          searchTexts: ['medium dried']
        },
        {
          type: 'simple',
          label: 'luxe_dried',
          searchTexts: ['luxe dried','dried luxe']
        }
      ]
    },
    {
      name: 'table_2',
      rows: [
        {
          type: 'complex',
          label: 'small_posy',
          fields: [
            {
              fieldName: 'BAU',
              searchTexts: ['small posy']
            },
            {
              fieldName: 'Native',
              searchTexts: ['small native posy']
            }
          ]
        },
        {
          type: 'complex',
          label: 'medium_posy_pink',
          fields: [
            {
              fieldName: 'BAU',
              searchTexts: ['classic posy','medium pretty in pink','medium bouquet', 'classic seasonal posy']
            },
            {
              fieldName: 'Native',
              searchTexts: ['medium native posy','classic native posy','medium native beauty','medium native bouquet']
            }
          ]
        },
        {
          type: 'complex',
          label: 'medium_posy_white',
          fields: [
            {
              fieldName: 'BAU',
              searchTexts: ['medium style','medium white bouquet','classic posy - white','classic white posy']
            }
          ]
        },
        {
          type: 'complex',
          label: 'large_posy_pink',
          fields: [
            {
              fieldName: 'BAU',
              searchTexts: ['large posy','large pretty in pink','large bouquet', 'large seasonal posy']
            },
            {
              fieldName: 'Native',
              searchTexts: ['large native posy','large native beauty','large native bouquet','just for you - large bouquet + vase']
            }
          ]
        },
        {
          type: 'complex',
          label: 'large_posy_white',
          fields: [
            {
              fieldName: 'BAU',
              searchTexts: ['large style & grace','thinking of you - large bouquet + vase','large posy - white','large white posy','large white bouquet']
            }
          ]
        },
        {
          type: 'complex',
          label: 'luxe_posy_pink',
          fields: [
            {
              fieldName: 'BAU',
              searchTexts: ['luxe posy','luxe pretty in pink','luxe bouquet', 'luxe seasonal posy']
            },
            {
              fieldName: 'Native',
              searchTexts: ['luxe native']
            }
          ]
        },
        {
          type: 'complex',
          label: 'luxe_posy_white',
          fields: [
            {
              fieldName: 'BAU',
              searchTexts: ['luxe posy - white','luxe white','luxe white bouquet','luxe style & grace']
            }
          ]
        }
      ]
    },
    {
      name: 'table_3',
      rows: [
        {
          type: 'complex',
          label: 'pink_roses',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['10 pink rose','10 pink stems','sweetheart bundle - 10 stems']
            },
            {
              fieldName: 'large',
              searchTexts: ['20 pink rose','20 pink stems','sweetheart bundle - 20 stems']
            }
          ]
        },
        {
          type: 'complex',
          label: 'red_roses',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['10 red rose','10 red stems','10 pink & red rose stems']
            },
            {
              fieldName: 'large',
              searchTexts: ['20 red rose','20 red stems']
            }
          ]
        },
        {
          type: 'complex',
          label: 'lisianthus',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['lisianthus - medium','medium lisianthus','lisianthus lover']
            },
            {
              fieldName: 'large',
              searchTexts: ['lisianthus - large','large lisianthus']
            }
          ]
        },
        {
          type: 'complex',
          label: 'snapdragons',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['snapdragons - medium','medium snapdragons']
            },
            {
              fieldName: 'large',
              searchTexts: ['snapdragons - large','large snapdragons']
            }
          ]
        },
        {
          type: 'complex',
          label: 'disbuds',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['disbuds - medium','medium disbuds','delightful disbuds']
            },
            {
              fieldName: 'large',
              searchTexts: ['disbuds - large','large disbuds']
            }
          ]
        },
        {
          type: 'complex',
          label: 'ranunculus',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['ranunculus - medium','medium ranunculus']
            },
            {
              fieldName: 'large',
              searchTexts: ['ranunculus - large','large ranunculus']
            }
          ]
        },
        {
          type: 'complex',
          label: 'sunflowers',
          fields: [
            {
              fieldName: 'small',
              searchTexts: ['sunflowers - small','small sunflowers']
            },
            {
              fieldName: 'medium',
              searchTexts: ['sunflowers - medium','medium sunflowers']
            },
            {
              fieldName: 'large',
              searchTexts: ['sunflowers - large','large sunflowers']
            }
          ]
        },
        {
          type: 'complex',
          label: 'tulips',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['tulips - medium','medium tulips','tickled pink tulips']
            },
            {
              fieldName: 'large',
              searchTexts: ['tulips - large','large tulips']
            }
          ]
        },
        {
          type: 'complex',
          label: 'florist_pick',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ["florist's pick - medium","medium florist's choice","florist‚Äôs pick - medium","medium florist‚Äôs choice"]
            },
            {
              fieldName: 'large',
              searchTexts: ["florist's pick - large","large florist's choice","florist‚Äôs pick - large","large florist‚Äôs choice"]
            }
          ]
        },
        {
          type: 'complex',
          label: 'red_roses_partial',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['10 pink & red rose stems','30 pink & red rose stems']
            }
          ]
        },
        {
          type: 'complex',
          label: 'white_roses',
          fields: [
            {
              fieldName: 'small',
              searchTexts: ['10 white rose','10 white stems']
            },
            {
              fieldName: 'medium',
              searchTexts: ['20 white rose','20 white stems']
            }
          ]
        },
        {
          type: 'complex',
          label: 'daffodils',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['daffodils - medium','medium daffodil bouquet']
            }
          ]
        },
        {
          type: 'complex',
          label: 'protea',
          fields: [
            {
              fieldName: 'small',
              searchTexts: ['proteas - 5 stems','5 protea stems']
            },
            {
              fieldName: 'medium',
              searchTexts: ['proteas - 10 stems','10 protea stems']
            }
          ]
        },
        {
          type: 'complex',
          label: 'spray_roses',
          fields: [
            {
              fieldName: 'small',
              searchTexts: ['spray roses - medium','medium spray roses','peachy keen roses']
            },
            {
              fieldName: 'medium',
              searchTexts: ['spray roses - large','large spray roses','grand keen roses']
            }
          ]
        },
        {
          type: 'complex',
          label: 'orchid_flowers',
          fields: [
            {
              fieldName: 'small',
              searchTexts: ['orchid flowers']
            }
          ]
        },
        {
          type: 'complex',
          label: 'peonies',
          fields: [
            {
              fieldName: 'small',
              searchTexts: ['peonies - small','small peonies']
            },
            {
              fieldName: 'medium',
              searchTexts: ['peonies - medium','medium peonies']
            },
            {
              fieldName: 'large',
              searchTexts: ['peonies - large','large peonies']
            }
          ]
        }
      ]
    },
    {
      name: 'table_4',
      rows: [
        {
          type: 'simple',
          label: 'long_stem_6',
          searchTexts: ['6 long']
        },
        {
          type: 'simple',
          label: 'long_stem_12',
          searchTexts: ['12 long']
        },
        {
          type: 'simple',
          label: 'long_stem_24',
          searchTexts: ['24 long']
        }
      ]
    },
    {
      name: 'table_5',
      rows: [
        {
          type: 'simple',
          label: 'baby_breath',
          searchTexts: ["baby's breath bouquet"]
        },
        {
          type: 'simple',
          label: 'sweet_kisses',
          searchTexts: ['sweet kisses','i love you - one size']
        },
        {
          type: 'simple',
          label: 'colour_splash',
          searchTexts: ['colour splash','go party']
        },
        {
          type: 'simple',
          label: 'cherry_love_large',
          searchTexts: ['large cherry love bouquet','large cherry on top posy','ruby rose']
        },
        {
          type: 'simple',
          label: 'cherry_love_luxe',
          searchTexts: ['luxe cherry love bouquet','luxe cherry on top posy']
        },
        {
          type: 'simple',
          label: 'plant_lucky_dip',
          searchTexts: ['plant + pot lucky dip','plant with pot']
        }
      ]
    },
    {
      name: 'table_6',
      rows: [
        {
          type: 'simple',
          label: 'orchid_total',
          searchTexts: ['orchid']
        },
        {
          type: 'simple',
          label: 'cuddly_cactus',
          searchTexts: ['cactus']
        },
        {
          type: 'simple',
          label: 'devils_ivy',
          searchTexts: ["devil's ivy"]
        },
        {
          type: 'simple',
          label: 'monstera',
          searchTexts: ['monstera']
        },
        {
          type: 'simple',
          label: 'rubber_plant',
          searchTexts: ['rubber plant']
        },
        {
          type: 'simple',
          label: 'peacock_plant',
          searchTexts: ['peacock']
        },
        {
          type: 'simple',
          label: 'birds_of_paradise',
          searchTexts: ['of paradise']
        },
        {
          type: 'simple',
          label: 'lady_palm',
          searchTexts: ['lady palm']
        },
        {
          type: 'simple',
          label: 'bird_nest',
          searchTexts: ["bird's nest"]
        }
      ]
    },
    {
      name: 'table_7',
      rows: [
        {
          type: 'complex',
          label: 'white_funeral',
          fields: [
            {
              fieldName: 'wreath',
              searchTexts: ['white sympathy wreath','white wreath']
            },
            {
              fieldName: 'standard',
              searchTexts: ['white casket flower arrangement','white casket flowers']
            },
            {
              fieldName: 'premium',
              searchTexts: ['premium white casket flower arrangement']
            }
          ]
        },
        {
          type: 'complex',
          label: 'pink_funeral',
          fields: [
            {
              fieldName: 'wreath',
              searchTexts: ['pink sympathy wreath','pink wreath']
            },
            {
              fieldName: 'standard',
              searchTexts: ['pink casket flower arrangement','pink casket flowers']
            },
            {
              fieldName: 'premium',
              searchTexts: ['premium pink casket flower arrangement']
            }
          ]
        },
        {
          type: 'complex',
          label: 'native_funeral',
          fields: [
            {
              fieldName: 'wreath',
              searchTexts: ['native sympathy wreath','native wreath']
            },
            {
              fieldName: 'standard',
              searchTexts: ['native casket flower arrangement','native casket flowers']
            },
            {
              fieldName: 'premium',
              searchTexts: ['premium native casket flower arrangement']
            }
          ]
        },
        {
          type: 'complex',
          label: 'colour_funeral',
          fields: [
            {
              fieldName: 'wreath',
              searchTexts: ['colour sympathy wreath','colour wreath']
            },
            {
              fieldName: 'standard',
              searchTexts: ['bright casket flower arrangement','bright casket flowers']
            },
            {
              fieldName: 'premium',
              searchTexts: ['premium bright casket flower arrangement']
            }
          ]
        },
        {
          type: 'complex',
          label: 'rose_funeral',
          fields: [
            {
              fieldName: 'standard',
              searchTexts: ['rose casket flower arrangement','rose casket flowers']
            },
            {
              fieldName: 'premium',
              searchTexts: ['premium rose casket flower arrangement']
            }
          ]
        }
      ]
    },
    {
      name: 'table_8',
      rows: [
        {
          type: 'simple',
          label: 'darling_roses',
          searchTexts: ['darling roses','sweet as','sweet sunrise']
        },
        {
          type: 'simple',
          label: 'on_my_mind',
          searchTexts: ['on my mind','you are enough','from the heart']
        },
        {
          type: 'simple',
          label: 'strike_a_rose',
          searchTexts: ['strike a rose','happy thoughts','blooming beauty','remember the time']
        },
        {
          type: 'simple',
          label: 'peaches_and_dream',
          searchTexts: ['peaches and dream','coral sunset']
        },
        {
          type: 'simple',
          label: 'jadore_roses',
          searchTexts: ['adore roses','love story','orchid elegance']
        },
        {
          type: 'simple',
          label: 'feel_the_rush',
          searchTexts: ['feel the rush','wildest dreams','my world']
        },
        {
          type: 'simple',
          label: 'head_over_heels',
          searchTexts: ['head over heels','love reflex','promise you']
        }
      ]
    },
    {
      name: 'table_9',
      rows: [
        {
          type: 'simple',
          label: 'blue_hydrangea',
          searchTexts: ['blue hydrangea']
        },
        {
          type: 'simple',
          label: 'green_hydrangea',
          searchTexts: ['green hydrangea']
        }
      ]
    },
    {
      name: 'table_10',
      rows: [
        {
          type: 'complex',
          label: 'auburn_glow',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['medium - auburn glow']
            },
            {
              fieldName: 'large',
              searchTexts: ['large - auburn glow']
            }
          ]
        },
        {
          type: 'complex',
          label: 'dream_girl',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['medium - dream girl']
            },
            {
              fieldName: 'large',
              searchTexts: ['large - dream girl']
            }
          ]
        },
        {
          type: 'complex',
          label: 'sorbet',
          fields: [
            {
              fieldName: 'medium',
              searchTexts: ['medium - sorbet']
            },
            {
              fieldName: 'large',
              searchTexts: ['large - sorbet']
            }
          ]
        }
      ]
    }
  ]
  
};


const PRODUCT_TALLY_RULES_SAMPLE = {
  tables: [
    {
      name: 'placeholder_table_1',
      rows: [
        {
          type: 'simple',
          label: 'Luxe_Products',
          searchTexts: ['luxe']
        },
        {
          type: 'simple',
          label: 'Large_Products',
          searchTexts: ['large']
        }
      ]
    },
    {
      name: 'placeholder_table_2',
      rows: [
        {
          type: 'complex',
          label: 'Candle',
          fields: [
            {
              fieldName: 'Small',
              searchTexts: ['small candle', 'mini candle']
            },
            {
              fieldName: 'Medium',
              searchTexts: ['medium candle', 'regular candle']
            },
            {
              fieldName: 'Large',
              searchTexts: ['large candle', 'big candle']
            }
          ]
        },
        {
          type: 'complex',
          label: 'Polaroid',
          fields: [
            {
              fieldName: 'Small',
              searchTexts: ['small polaroid', 'mini polaroid']
            },
            {
              fieldName: 'Medium',
              searchTexts: ['medium polaroid']
            },
            {
              fieldName: 'Large',
              searchTexts: ['large polaroid', 'big polaroid']
            }
          ]
        },
        {
          type: 'simple',
          label: 'Prosecco',
          searchTexts: ['prosecco', 'champagne']
        }
      ]
    }
  ]
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
    'gp_timeframe',
    'timestamp'
  ]
};

// ============================================================================
// EMAIL NOTIFICATION CONFIGURATION (SendGrid) - Store-Specific Recipients
// ============================================================================

const EMAIL_CONFIG = {
  // SendGrid API configuration
  sendgridApiKey: process.env.SENDGRID_API_KEY,

  // From email (same for all stores, MUST be verified in SendGrid)
  from: {
    email: 'orders@em9870.flowerchimp.com',  // MUST be verified in SendGrid
    name: 'Order Processing Alerts'
  },

  // Store-specific recipient configuration
  // shop_id 10 = LVLY, shop_id 6 = Bloomeroo (BL)
  recipients: {
    LVLY: {
      to: ['sailesh@limitless.my']
    },
    BL: {
      to: ['sailesh@limitless.my']
    },
    default: {
      // Fallback if store cannot be determined
      to: ['sailesh@limitless.my']
    }
  },

  // Helper function to get recipients based on store
  getRecipients: (store) => {
    if (store === 'LVLY') {
      return EMAIL_CONFIG.recipients.LVLY;
    } else if (store === 'BL') {
      return EMAIL_CONFIG.recipients.BL;
    } else {
      console.warn(`⚠️ Unknown store: ${store}, using default recipients`);
      return EMAIL_CONFIG.recipients.default;
    }
  },

  // Email template for unsuccessful orders
  template: {
    // Subject includes location, order number, and store
    subject: (order) => `⚠️ Order Processing Failed - ${order.location} - Order #${order.order_number} - ${order.store || 'Unknown Store'}`,

    // HTML email body generator
    generateBody: (order) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f44336; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .store-badge { display: inline-block; background-color: ${order.store === 'LVLY' ? '#2196F3' : '#9C27B0'}; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; margin-left: 10px; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 18px; font-weight: bold; color: #f44336; margin-bottom: 10px; border-bottom: 2px solid #f44336; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; background-color: white; }
          th, td { padding: 12px; text-align: left; border: 1px solid #ddd; }
          th { background-color: #f44336; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .status-success { color: #4caf50; font-weight: bold; }
          .status-fail { color: #f44336; font-weight: bold; }
          .error-box { background-color: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 10px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 2px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Order Processing Failed <span class="store-badge">${order.store || 'N/A'}</span></h1>
          </div>

          <div class="content">
            <!-- ORDER INFORMATION SECTION -->
            <div class="section">
              <div class="section-title">📦 Order Information</div>
              <table>
                <tr><th>Field</th><th>Value</th></tr>
                <tr><td><strong>Order Number</strong></td><td>${order.order_number}</td></tr>
                <tr><td><strong>Store/Brand</strong></td><td><strong style="color: ${order.store === 'LVLY' ? '#2196F3' : '#9C27B0'};">${order.store || 'N/A'}</strong></td></tr>
                <tr><td><strong>Location</strong></td><td>${order.location || 'N/A'}</td></tr>
                <tr><td><strong>Delivery Date</strong></td><td>${order.delivery_date || 'N/A'}</td></tr>
                <tr><td><strong>Service Type</strong></td><td>${order.is_same_day || 'N/A'}</td></tr>
                <tr><td><strong>Batch Number</strong></td><td>${order.batch || 'N/A'}</td></tr>
              </table>
            </div>

            <!-- LOGISTICS STATUS SECTION -->
            <div class="section">
              <div class="section-title">🚚 Logistics Status</div>
              <table>
                <tr><th>Provider</th><th>Status</th><th>Error Details</th></tr>
                <tr>
                  <td><strong>GoPeople</strong></td>
                  <td class="${order.gopeople_status ? 'status-success' : 'status-fail'}">
                    ${order.gopeople_status ? '✅ Success' : '❌ Failed'}
                  </td>
                  <td>${order.gopeople_error || '-'}</td>
                </tr>
                <tr>
                  <td><strong>AusPost</strong></td>
                  <td class="${order.auspost_status ? 'status-success' : 'status-fail'}">
                    ${order.auspost_status ? '✅ Success' : '❌ Failed'}
                  </td>
                  <td>${order.auspost_error || '-'}</td>
                </tr>
              </table>
            </div>

            <!-- FOOTER -->
            <div class="footer">
              <p><strong>Email sent:</strong> ${new Date().toISOString()}</p>
              <p><strong>Store:</strong> ${order.store || 'Unknown'} | <strong>Recipients:</strong> This email was sent to the ${order.store} operations team</p>
              <p><strong>Action Required:</strong> Please review this order in the system and take appropriate action.</p>
              <p style="color: #999; margin-top: 15px;">This is an automated notification from the AU Order Management system.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }
};


// Export all configurations
module.exports = {
  // GoPeople module exports
  GOPEOPLE_API_URL_PROD,
  GOPEOPLE_API_URL_TEST,
  GOPEOPLE_TIMEFRAME_API_URL_PROD,
  GOPEOPLE_TIMEFRAME_API_URL_TEST,
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
  AUSPOST_LABELS_CONFIG,
  // Other exports
  GOOGLE_DRIVE_CONFIG,
  PERSONALIZED_API_CONFIG,
  GP_LABELS_API_CONFIG,
  AUSPOST_LABELS_API_CONFIG,
  PRODUCT_TALLY_API_CONFIG,
  PRODUCT_TALLY_RULES,
  GOOGLE_SHEETS_CONFIG,
  EMAIL_CONFIG
};