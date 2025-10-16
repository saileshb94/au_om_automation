// Import configuration and utilities
const {
  LOCATION_ADDRESSES,
  LOCATION_TIMEZONES,
  GOPEOPLE_PARCEL_DEFAULTS,
  GOPEOPLE_DELIVERY_DEFAULTS,
  PICKUP_TIME_RULES
} = require('../config');
const TimezoneHelper = require('../utils/TimezoneHelper');

const query = `
SELECT 
    so.id, 
    so.shop_id,
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
WHERE sode.is_same_day = 1
ORDER BY so.created_at DESC
LIMIT 100;
`;

// Timezone functions moved to TimezoneHelper utility

// Helper function to calculate the pickup time based on current time and available slots
function calculatePickupTime(location, deliveryDate) {
  console.log(`\n⏰ [calculatePickupTime] Processing for ${location}, delivery date: ${deliveryDate}`);

  // Get location timezone info
  const locationTz = LOCATION_TIMEZONES[location];
  if (!locationTz) {
    console.error(`No timezone info for location: ${location}`);
    return null;
  }

  // Get current time in the location's timezone
  const locationTime = TimezoneHelper.getLocationTime(location);
  if (!locationTime) return null;

  // Get the day of week for the delivery date
  const deliveryDateObj = new Date(deliveryDate);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[deliveryDateObj.getDay()];

  console.log(`📅 Delivery day of week: ${dayOfWeek}`);

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

  console.log(`🎯 Available slots for ${location} on ${dayOfWeek}:`, slots.map(s => `Pickup: ${s.pickupTime}, Cutoff: ${s.cutoffTime}`).join(' | '));

  // Get current time in HH:MM format
  const currentTimeStr = TimezoneHelper.formatTimeString(locationTime);

  // Check if delivery date is today
  const isToday = deliveryDateObj.toDateString() === locationTime.toDateString();

  console.log(`📆 Is delivery for today? ${isToday ? 'YES' : 'NO (future date)'}`);
  console.log(`⏱️  Current local time: ${currentTimeStr}`);

  // If delivery is for today, find the next available slot
  if (isToday) {
    console.log(`🔍 Checking cutoff times for same-day delivery...`);
    for (const slot of slots) {
      console.log(`   Comparing: ${currentTimeStr} < ${slot.cutoffTime}? ${currentTimeStr < slot.cutoffTime ? '✅ YES' : '❌ NO'}`);
      if (currentTimeStr < slot.cutoffTime) {
        console.log(`✅ [RESULT] Selected pickup time: ${slot.pickupTime} (before cutoff ${slot.cutoffTime})`);
        return slot.pickupTime;
      }
    }

    // If current time is after all cutoff times, no pickup available for today
    console.log(`❌ [RESULT] Current time ${currentTimeStr} is after all cutoff times for ${location}`);
    console.log(`   Order will be SKIPPED\n`);
    return null; // This will cause the order to be skipped
  } else {
    // For future dates, use the first available slot
    console.log(`✅ [RESULT] Future delivery - using first slot: ${slots[0].pickupTime}\n`);
    return slots[0].pickupTime;
  }
}

// Transform function to convert query results to GoPeople API format
// manualTimeframe: optional parameter for manual processing (format: "2025-10-14 14:30:00+11:00")
function transform(rawData, deliveryDate, manualTimeframe = null) {
  console.log(`\n🔄 === GOPEOPLE TRANSFORM STARTING ===`);
  console.log(`📥 Total orders from database: ${rawData ? rawData.length : 0}`);
  if (manualTimeframe) {
    console.log(`🔧 Manual timeframe provided: ${manualTimeframe} (will bypass pickup time calculation)`);
  }

  if (!rawData || !Array.isArray(rawData)) {
    console.log(`⚠️ No data to transform`);
    console.log(`=== END GOPEOPLE TRANSFORM ===\n`);
    return [];
  }

  const transformedOrders = [];
  const skippedOrders = [];

  for (const row of rawData) {
    // Get the addressFrom based on location
    const addressFrom = LOCATION_ADDRESSES[row.location_name] || LOCATION_ADDRESSES['Melbourne'];

    // Calculate or use manual pickup date/time
    console.log(`\n📦 Processing Order: ${row.order_number} (Location: ${row.location_name})`);

    let pickUpDate;

    if (manualTimeframe) {
      // Manual mode: use provided timeframe directly (already includes timezone)
      pickUpDate = manualTimeframe;
      console.log(`✅ [MANUAL TIMEFRAME] Order ${row.order_number} - using provided timeframe: ${pickUpDate}`);
    } else {
      // Automatic mode: calculate pickup time based on cutoff rules
      const pickupTime = calculatePickupTime(row.location_name, deliveryDate || row.delivery_date);

      // If no pickup time available (past cutoff), skip this order
      if (!pickupTime) {
        console.log(`⏭️  [ORDER SKIPPED] Order ${row.order_number} - past cutoff time for location ${row.location_name}\n`);
        skippedOrders.push({
          orderNumber: row.order_number,
          location: row.location_name,
          reason: 'Past cutoff time for all available pickup slots'
        });
        continue; // Skip this order
      }

      console.log(`✅ [ORDER ACCEPTED] Order ${row.order_number} - pickup time assigned: ${pickupTime}`);

      // Format pickup date with correct timezone
      const pickupDateBase = deliveryDate || row.delivery_date;
      const timezoneOffset = TimezoneHelper.getTimezoneOffset(row.location_name, pickupDateBase);
      pickUpDate = `${pickupDateBase} ${pickupTime}:00${timezoneOffset}`;
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);


    // Determine unit field
    let unit = '';
    if (row.building_name && row.building_name !== '') {
      unit = row.room_number ? `${row.room_number}, ${row.building_name}` : row.building_name;
    } else {
      unit = row.room_number || '';
    }

    // Determine isCommercial based on residence_type
    const isCommercial = row.residence_type !== 'House/Unit/Apartment';
    
    transformedOrders.push({
      orderNumber: row.order_number, // Keep this for tracking
      location_name: row.location_name, // Add location for GP Labels processing
      delivery_date: deliveryDate || row.delivery_date, // Add delivery date for GP Labels processing
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
  console.log(`\n📊 === GOPEOPLE TRANSFORM SUMMARY ===`);
  console.log(`✅ Orders ready for API: ${transformedOrders.length}`);
  console.log(`⏰ Orders skipped (past cutoff): ${skippedOrders.length}`);
  console.log(`📈 Total processed: ${rawData.length} (${transformedOrders.length} ready + ${skippedOrders.length} skipped)`);

  if (skippedOrders.length > 0) {
    console.log(`\n❌ Skipped order details:`, skippedOrders);
  }

  console.log(`=== END GOPEOPLE TRANSFORM ===\n`);

  return transformedOrders;
}

module.exports = {
  query,
  transform
};