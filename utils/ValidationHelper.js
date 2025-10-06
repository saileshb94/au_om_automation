class ValidationHelper {
  static parseDevMode(devModeParam) {
    // Default to "11111" if not provided or invalid (5-digit format)
    const defaultMode = "11111";

    if (!devModeParam || typeof devModeParam !== 'string') {
      console.log(`Invalid dev_mode parameter: ${devModeParam}, using default: ${defaultMode}`);
      return defaultMode;
    }

    // Support 2-digit (legacy), 3-digit, 4-digit, and 5-digit formats
    if (devModeParam.length === 2) {
      // Legacy 2-digit format: convert to 5-digit by adding '11' for personalized/GP labels APIs and '0' for Google Sheets
      if (!/^[01][01]$/.test(devModeParam)) {
        console.log(`Invalid 2-digit dev_mode format: ${devModeParam}, using default: ${defaultMode}`);
        return defaultMode;
      }
      const convertedMode = devModeParam[0] + '11' + devModeParam[1] + '0'; // Insert '11' for personalized/GP labels, '0' for Sheets
      console.log(`Legacy 2-digit dev_mode converted: ${devModeParam} → ${convertedMode} (gopeople: ${convertedMode[0]}, personalized: ${convertedMode[1]}, gp_labels: ${convertedMode[2]}, fos_update: ${convertedMode[3]}, google_sheets: ${convertedMode[4]})`);
      return convertedMode;
    } else if (devModeParam.length === 3) {
      // 3-digit format: convert to 5-digit by adding '1' for GP labels API and '0' for Google Sheets
      if (!/^[01][01][01]$/.test(devModeParam)) {
        console.log(`Invalid 3-digit dev_mode format: ${devModeParam}, using default: ${defaultMode}`);
        return defaultMode;
      }
      const convertedMode = devModeParam[0] + devModeParam[1] + '1' + devModeParam[2] + '0'; // Insert '1' for GP labels, '0' for Sheets
      console.log(`3-digit dev_mode converted: ${devModeParam} → ${convertedMode} (gopeople: ${convertedMode[0]}, personalized: ${convertedMode[1]}, gp_labels: ${convertedMode[2]}, fos_update: ${convertedMode[3]}, google_sheets: ${convertedMode[4]})`);
      return convertedMode;
    } else if (devModeParam.length === 4) {
      // 4-digit format: convert to 5-digit by adding '0' for Google Sheets (disabled by default for backward compatibility)
      if (!/^[01][01][01][01]$/.test(devModeParam)) {
        console.log(`Invalid 4-digit dev_mode format: ${devModeParam}, using default: ${defaultMode}`);
        return defaultMode;
      }
      const convertedMode = devModeParam + '0'; // Append '0' for Google Sheets
      console.log(`4-digit dev_mode converted: ${devModeParam} → ${convertedMode} (gopeople: ${convertedMode[0]}, personalized: ${convertedMode[1]}, gp_labels: ${convertedMode[2]}, fos_update: ${convertedMode[3]}, google_sheets: ${convertedMode[4]})`);
      return convertedMode;
    } else if (devModeParam.length === 5) {
      // New 5-digit format
      if (!/^[01][01][01][01][01]$/.test(devModeParam)) {
        console.log(`Invalid 5-digit dev_mode format: ${devModeParam}, using default: ${defaultMode}`);
        return defaultMode;
      }
      console.log(`Dev mode parsed: ${devModeParam} (gopeople: ${devModeParam[0]}, personalized: ${devModeParam[1]}, gp_labels: ${devModeParam[2]}, fos_update: ${devModeParam[3]}, google_sheets: ${devModeParam[4]})`);
      return devModeParam;
    } else {
      console.log(`Invalid dev_mode length: ${devModeParam}, using default: ${defaultMode}`);
      return defaultMode;
    }
  }

  static parseIsSameDay(isSameDayParam) {
    // Default to "1" (GoPeople) if not provided
    const defaultValue = "1";

    if (!isSameDayParam) {
      console.log(`is_same_day parameter not provided, using default: ${defaultValue} (GoPeople)`);
      return defaultValue;
    }

    // Convert to string and validate
    const value = String(isSameDayParam);

    if (value !== '0' && value !== '1') {
      console.log(`Invalid is_same_day parameter: ${isSameDayParam}, using default: ${defaultValue} (GoPeople)`);
      return defaultValue;
    }

    console.log(`is_same_day parameter parsed: ${value} (${value === '1' ? 'GoPeople' : 'Auspost'})`);
    return value;
  }

  static parseLocation(locationParam) {
    // Valid Australian cities supported by the system
    const validCities = ['Melbourne', 'Sydney', 'Perth', 'Adelaide', 'Brisbane'];

    if (!locationParam || locationParam.trim() === '') {
      console.log('location parameter not provided or empty, will process all locations');
      return {
        locations: [],
        hasLocationFilter: false
      };
    }

    // Split by comma, trim whitespace, and filter empty strings
    const locations = locationParam
      .split(',')
      .map(loc => loc.trim())
      .filter(loc => loc.length > 0);

    // Validate against known cities
    const validLocations = locations.filter(loc => validCities.includes(loc));
    const invalidLocations = locations.filter(loc => !validCities.includes(loc));

    if (invalidLocations.length > 0) {
      console.log(`Warning: Invalid location(s) ignored: ${invalidLocations.join(', ')}`);
    }

    if (validLocations.length === 0) {
      console.log('No valid locations provided, will process all locations');
      return {
        locations: [],
        hasLocationFilter: false
      };
    }

    console.log(`location parameter parsed: ${validLocations.join(', ')} (${validLocations.length} location${validLocations.length > 1 ? 's' : ''})`);
    return {
      locations: validLocations,
      hasLocationFilter: true
    };
  }

  static parseStore(storeParam) {
    // Default to "1" (LVLY only) if not provided
    const defaultValue = "1";

    if (!storeParam) {
      console.log(`store parameter not provided, using default: ${defaultValue} (LVLY - shop_id=10)`);
      return {
        store: defaultValue,
        shop_ids: [10],
        shop_id_filter: '10'
      };
    }

    // Convert to string and validate
    const value = String(storeParam);

    if (value !== '1' && value !== '2' && value !== '3') {
      console.log(`Invalid store parameter: ${storeParam}, using default: ${defaultValue} (LVLY - shop_id=10)`);
      return {
        store: defaultValue,
        shop_ids: [10],
        shop_id_filter: '10'
      };
    }

    // Map store to shop_ids
    let shop_ids, shop_id_filter, description;
    if (value === '1') {
      shop_ids = [10];
      shop_id_filter = '10';
      description = 'LVLY (shop_id=10)';
    } else if (value === '2') {
      shop_ids = [6];
      shop_id_filter = '6';
      description = 'Bloomeroo (shop_id=6)';
    } else { // value === '3'
      shop_ids = [10, 6];
      shop_id_filter = '10, 6';
      description = 'Both stores (shop_id IN (10, 6))';
    }

    console.log(`store parameter parsed: ${value} → ${description}`);
    return {
      store: value,
      shop_ids: shop_ids,
      shop_id_filter: shop_id_filter
    };
  }

  static parseAndValidateRequestParams(query) {
    const storeInfo = ValidationHelper.parseStore(query.store);
    const locationInfo = ValidationHelper.parseLocation(query.location);

    return {
      date: query.date || null,
      locations: locationInfo.locations,
      hasLocationFilter: locationInfo.hasLocationFilter,
      dev_mode: ValidationHelper.parseDevMode(query.dev_mode),
      is_same_day: ValidationHelper.parseIsSameDay(query.is_same_day),
      store: storeInfo.store,
      shop_ids: storeInfo.shop_ids,
      shop_id_filter: storeInfo.shop_id_filter
    };
  }
}

module.exports = ValidationHelper;