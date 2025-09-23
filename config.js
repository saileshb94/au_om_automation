/**
 * Configuration file for various modules
 * Contains constants and settings used across different scripts
 */

// ============================================================================
// GOPEOPLE MODULE CONFIGURATION
// ============================================================================

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
// OTHER MODULE CONFIGURATIONS (if needed in future)
// ============================================================================

const GOOGLE_DRIVE_CONFIG = {
  mainFolderId: process.env.GOOGLE_DRIVE_MAIN_FOLDER_ID, // This should be the Shared Drive ID
  credentialsJson: process.env.GOOGLE_DRIVE_CREDENTIALS_JSON,
  imageSettings: {
    downloadTimeout: 30000,
    maxFileSize: 10 * 1024 * 1024, // 10MB limit
    supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
    batchProcessingSize: 3, // Process 3 images at a time
    batchDelay: 1000, // 1 second delay between batches
    useStreaming: true
  }
};


// Export all configurations
module.exports = {
  // GoPeople module exports
  LOCATION_ADDRESSES,
  LOCATION_TIMEZONES,
  GOPEOPLE_PARCEL_DEFAULTS,
  GOPEOPLE_DELIVERY_DEFAULTS,
  PICKUP_TIME_RULES,
  GOOGLE_DRIVE_CONFIG
};