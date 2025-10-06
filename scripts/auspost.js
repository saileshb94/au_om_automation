// Import configuration and utilities
const {
  AUSPOST_LOCATION_ADDRESSES,
  LOCATION_TIMEZONES,
  AUSPOST_SHIPMENT_DEFAULTS,
  AUSPOST_CUTOFF_RULES
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
WHERE sode.is_same_day = 0
ORDER BY so.created_at DESC
LIMIT 100;
`;

// Helper function to check cutoff time for Auspost (simplified - single cutoff per day)
function checkCutoffTime(location, deliveryDate) {
  console.log(`\n🕐 Checking Auspost cutoff time for ${location}, delivery date: ${deliveryDate}`);

  // Get location timezone info
  const locationTz = LOCATION_TIMEZONES[location];
  if (!locationTz) {
    console.error(`No timezone info for location: ${location}`);
    return false;
  }

  // Get current time in the location's timezone
  const locationTime = TimezoneHelper.getLocationTime(location);
  if (!locationTime) {
    console.error(`Could not get location time for: ${location}`);
    return false;
  }

  // Get the day of week for the delivery date
  const deliveryDateObj = new Date(deliveryDate);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[deliveryDateObj.getDay()];

  console.log(`📅 Delivery day of week: ${dayOfWeek}`);

  // Get cutoff rules for this location and day
  const locationRules = AUSPOST_CUTOFF_RULES[location];
  if (!locationRules || !locationRules[dayOfWeek]) {
    console.error(`No Auspost cutoff rules for ${location} on ${dayOfWeek}`);
    return false;
  }

  const dayRule = locationRules[dayOfWeek];

  // Check if delivery is enabled for this day
  if (!dayRule.enabled) {
    console.log(`❌ Auspost delivery not enabled for ${location} on ${dayOfWeek}`);
    return false;
  }

  // Get current time in HH:MM format
  const currentTimeStr = TimezoneHelper.formatTimeString(locationTime);

  // Check if delivery date is today
  const isToday = deliveryDateObj.toDateString() === locationTime.toDateString();

  console.log(`⏰ Current time in ${location}: ${currentTimeStr}`);
  console.log(`🎯 Cutoff time: ${dayRule.cutoffTime}`);
  console.log(`📆 Is today: ${isToday}`);

  // If delivery is for today, check if we're before cutoff
  if (isToday) {
    const beforeCutoff = currentTimeStr < dayRule.cutoffTime;
    console.log(`✅ Before cutoff: ${beforeCutoff ? 'YES' : 'NO'}`);
    return beforeCutoff;
  } else {
    // For future dates, always accept
    console.log(`✅ Future delivery date - accepting order`);
    return true;
  }
}

// Helper function to map state names to state codes
function mapStateToCode(stateName) {
  if (!stateName) return '';

  // If already a valid code, return as is
  const stateUpper = stateName.toUpperCase().trim();
  const validCodes = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  if (validCodes.includes(stateUpper)) {
    return stateUpper;
  }

  // Map full state names to codes
  const stateMap = {
    'VICTORIA': 'VIC',
    'NEW SOUTH WALES': 'NSW',
    'QUEENSLAND': 'QLD',
    'SOUTH AUSTRALIA': 'SA',
    'WESTERN AUSTRALIA': 'WA',
    'TASMANIA': 'TAS',
    'NORTHERN TERRITORY': 'NT',
    'AUSTRALIAN CAPITAL TERRITORY': 'ACT'
  };

  const mappedState = stateMap[stateUpper];

  if (mappedState) {
    console.log(`  Mapped state: "${stateName}" → "${mappedState}"`);
    return mappedState;
  }

  // If no mapping found, log warning and return original
  console.warn(`  ⚠️ Unknown state: "${stateName}" - returning as is`);
  return stateUpper;
}

// Transform function to convert query results to Auspost API format
function transform(rawData, deliveryDate) {
  console.log(`\n📦 === AUSPOST TRANSFORM START ===`);
  console.log(`Processing ${rawData?.length || 0} raw orders for Auspost API`);

  if (!rawData || !Array.isArray(rawData)) {
    console.log('❌ No valid data to transform');
    return [];
  }

  const transformedOrders = [];
  const skippedOrders = [];

  for (const row of rawData) {
    console.log(`\n--- Processing order: ${row.order_number} ---`);
    console.log(`Location: ${row.location_name}`);

    // Get the addressFrom based on location
    const addressFrom = AUSPOST_LOCATION_ADDRESSES[row.location_name] || AUSPOST_LOCATION_ADDRESSES['Melbourne'];
    console.log(`From address: ${addressFrom.suburb}, ${addressFrom.state}`);

    // Check cutoff time for this order
    const passesCutoff = checkCutoffTime(row.location_name, deliveryDate || row.delivery_date);

    // If past cutoff, skip this order
    if (!passesCutoff) {
      console.log(`⏭️ Skipping order ${row.order_number} - past cutoff time or delivery not enabled`);
      skippedOrders.push({
        orderNumber: row.order_number,
        location: row.location_name,
        reason: 'Past cutoff time or delivery not enabled for this day'
      });
      continue; // Skip this order
    }

    console.log(`✅ Order ${row.order_number} passes cutoff check`);

    // Determine business name (if available)
    const businessName = row.company || '';
    console.log(`Business name: ${businessName || '(none)'}`);

    // Build the "to" address lines array
    const toAddressLines = [];
    if (row.building_name) {
      toAddressLines.push(row.building_name);
    }
    if (row.room_number) {
      toAddressLines.push(row.room_number);
    }
    if (row.address) {
      toAddressLines.push(row.address);
    }

    // If no address lines, use a default
    if (toAddressLines.length === 0) {
      toAddressLines.push(row.address || 'Address not provided');
    }

    console.log(`To address lines: ${toAddressLines.join(' | ')}`);
    console.log(`To suburb: ${row.city}, ${row.province} ${row.zip}`);

    // Map state to code (e.g., "Victoria" → "VIC")
    const stateCode = mapStateToCode(row.province);

    // Build shipment object for Auspost API
    const shipmentObject = {
      shipment_reference: row.order_number,
      customer_reference_1: row.order_number,
      customer_reference_2: '', // SKU list - not available in current data, leaving empty
      generate_label_metadata: true,
      from: {
        name: addressFrom.name,
        lines: addressFrom.lines,
        suburb: addressFrom.suburb,
        state: addressFrom.state,
        postcode: addressFrom.postcode,
        phone: addressFrom.phone,
        email: addressFrom.email
      },
      to: {
        name: row.name || '',
        business_name: businessName,
        lines: toAddressLines,
        suburb: row.city || '',
        state: stateCode,
        postcode: row.zip || '',
        phone: row.phone || '',
        email: row.email || ''
      },
      items: [
        {
          item_reference: row.order_number,
          product_id: AUSPOST_SHIPMENT_DEFAULTS.product_id,
          packaging_type: AUSPOST_SHIPMENT_DEFAULTS.packaging_type,
          length: AUSPOST_SHIPMENT_DEFAULTS.length,
          height: AUSPOST_SHIPMENT_DEFAULTS.height,
          width: AUSPOST_SHIPMENT_DEFAULTS.width,
          weight: AUSPOST_SHIPMENT_DEFAULTS.weight,
          authority_to_leave: AUSPOST_SHIPMENT_DEFAULTS.authority_to_leave,
          allow_partial_delivery: AUSPOST_SHIPMENT_DEFAULTS.allow_partial_delivery
        }
      ]
    };

    console.log(`✅ Transformed order ${row.order_number} successfully`);

    transformedOrders.push({
      orderNumber: row.order_number,
      location_name: row.location_name,
      delivery_date: deliveryDate || row.delivery_date,
      apiPayload: shipmentObject
    });
  }

  // Log summary of processing
  console.log(`\n📊 === AUSPOST TRANSFORM SUMMARY ===`);
  console.log(`Total raw orders: ${rawData.length}`);
  console.log(`Transformed orders: ${transformedOrders.length}`);
  console.log(`Skipped orders: ${skippedOrders.length}`);

  if (skippedOrders.length > 0) {
    console.log(`\n⏭️ Skipped orders details:`);
    skippedOrders.forEach(skipped => {
      console.log(`  - ${skipped.orderNumber} (${skipped.location}): ${skipped.reason}`);
    });
  }

  console.log(`=== AUSPOST TRANSFORM END ===\n`);

  return transformedOrders;
}

module.exports = {
  query,
  transform
};
