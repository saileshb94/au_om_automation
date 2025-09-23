// Import configuration
const { 
  LOCATION_ADDRESSES, 
  LOCATION_TIMEZONES, 
  GOPEOPLE_PARCEL_DEFAULTS, 
  GOPEOPLE_DELIVERY_DEFAULTS,
  PICKUP_TIME_RULES 
} = require('./config');

const query = `
SELECT 
    so.id, 
    so.process_status, 
    sfl.location_name, 
    sode.delivery_date,
    so.order_number,
    sode.building_name,
    sode.room_number,
    sode.residence_type,
    sos.name, 
    CASE 
        WHEN sos.address2 IS NOT NULL AND sos.address2 != '' 
        THEN CONCAT(sos.address1, ', ', sos.address2)
        ELSE sos.address1
    END AS address,
    sos.phone, 
    sode.delivery_instructions,
    sos.city,
    sos.province,
    sos.zip,
    so.email,
    sos.company
FROM shopify_orders so
LEFT JOIN 
    shopify_order_additional_details sode ON so.id = sode.order_id
LEFT JOIN 
    shopify_order_shipping sos ON so.id = sos.order_id
LEFT JOIN 
    shopify_fulfillment_locations sfl ON so.fulfillment_location_id = sfl.id
WHERE so.shop_id = 10 
    AND sode.is_same_day = 1
ORDER BY so.created_at DESC
LIMIT 100;
`;

// Helper function to get the correct timezone offset based on date
function getTimezoneOffset(location, date) {
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

// Helper function to calculate the pickup time based on current time and available slots
function calculatePickupTime(location, deliveryDate) {
  // Get location timezone info
  const locationTz = LOCATION_TIMEZONES[location];
  if (!locationTz) {
    console.error(`No timezone info for location: ${location}`);
    return null;
  }
  
  // Get current time in the location's timezone
  const now = new Date();
  const locationTime = new Date(now.toLocaleString("en-US", { timeZone: locationTz.timezone }));
  
  // Get the day of week for the delivery date
  const deliveryDateObj = new Date(deliveryDate);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[deliveryDateObj.getDay()];
  
  // Get pickup slots for this location and day
  const locationRules = PICKUP_TIME_RULES[location];
  if (!locationRules || !locationRules[dayOfWeek]) {
    console.error(`No pickup rules for ${location} on ${dayOfWeek}`);
    return null;
  }
  
  const slots = locationRules[dayOfWeek].slots;
  if (!slots || slots.length === 0) {
    console.error(`No pickup slots available for ${location} on ${dayOfWeek}`);
    return null;
  }
  
  // Get current time in HH:MM format
  const currentHours = locationTime.getHours().toString().padStart(2, '0');
  const currentMinutes = locationTime.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;
  
  // Check if delivery date is today
  const isToday = deliveryDateObj.toDateString() === locationTime.toDateString();
  
  // If delivery is for today, find the next available slot
  if (isToday) {
    for (const slot of slots) {
      if (currentTimeStr < slot.cutoffTime) {
        return slot.pickupTime;
      }
    }
    
    // If current time is after all cutoff times, no pickup available for today
    console.log(`Current time ${currentTimeStr} is after all cutoff times for ${location}`);
    return null; // This will cause the order to be skipped
  } else {
    // For future dates, use the first available slot
    return slots[0].pickupTime;
  }
}

// Transform function to convert query results to GoPeople API format
function transform(rawData, deliveryDate) {
  if (!rawData || !Array.isArray(rawData)) {
    return [];
  }
  
  const transformedOrders = [];
  const skippedOrders = [];
  
  for (const row of rawData) {
    // Get the addressFrom based on location
    const addressFrom = LOCATION_ADDRESSES[row.location_name] || LOCATION_ADDRESSES['Melbourne'];
    
    // Calculate the pickup time for this order
    const pickupTime = calculatePickupTime(row.location_name, deliveryDate || row.delivery_date);
    
    // If no pickup time available (past cutoff), skip this order
    if (!pickupTime) {
      console.log(`Skipping order ${row.order_number} - past cutoff time for location ${row.location_name}`);
      skippedOrders.push({
        orderNumber: row.order_number,
        location: row.location_name,
        reason: 'Past cutoff time for all available pickup slots'
      });
      continue; // Skip this order
    }
    
    // Determine unit field
    let unit = '';
    if (row.building_name && row.building_name !== '') {
      unit = row.room_number ? `${row.room_number}, ${row.building_name}` : row.building_name;
    } else {
      unit = row.room_number || '';
    }
    
    // Determine isCommercial based on residence_type
    const isCommercial = row.residence_type !== 'House/Unit/Apartment';
    
    // Format pickup date with correct timezone
    const pickupDateBase = deliveryDate || row.delivery_date;
    const timezoneOffset = getTimezoneOffset(row.location_name, pickupDateBase);
    const pickUpDate = `${pickupDateBase} ${pickupTime}:00${timezoneOffset}`;
    
    transformedOrders.push({
      orderNumber: row.order_number, // Keep this for tracking
      apiPayload: {
        addressFrom: addressFrom,
        addressTo: {
          unit: unit,
          address1: row.address || '',
          suburb: row.city || '',
          state: row.province || '',
          postcode: row.zip || '',
          isCommercial: isCommercial,
          companyName: row.company || '',
          contacts: [{
            contactName: row.name || '',
            contactNumber: row.phone || '',
            sendUpdateSMS: GOPEOPLE_DELIVERY_DEFAULTS.sendUpdateSMS,
            contactEmail: row.email || '',
            sendUpdateEmail: GOPEOPLE_DELIVERY_DEFAULTS.sendUpdateEmail
          }]
        },
        parcels: [GOPEOPLE_PARCEL_DEFAULTS], // Use the default parcel configuration
        pickUpDate: pickUpDate,
        description: GOPEOPLE_DELIVERY_DEFAULTS.description,
        note: row.delivery_instructions || '',
        ref: `${GOPEOPLE_DELIVERY_DEFAULTS.refPrefix}${row.order_number}`,
        ref2: GOPEOPLE_DELIVERY_DEFAULTS.ref2,
        atl: GOPEOPLE_DELIVERY_DEFAULTS.atl,
        idCheckRequired: GOPEOPLE_DELIVERY_DEFAULTS.idCheckRequired,
        collectPointId: GOPEOPLE_DELIVERY_DEFAULTS.collectPointId
      }
    });
  }
  
  // Log summary of processing
  if (skippedOrders.length > 0) {
    console.log(`Processed ${transformedOrders.length} orders, skipped ${skippedOrders.length} orders due to cutoff times`);
    console.log('Skipped orders:', skippedOrders);
  }
  
  return transformedOrders;
}

module.exports = {
  query,
  transform
};