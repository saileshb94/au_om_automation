class ResponseFormatter {
  static combinePersonalizedAndPackingMessage(personalizedData, packingMessageData) {
    console.log('🎯 DEBUG: Combining personalized and packing-message data...');

    if (!personalizedData && !packingMessageData) {
      return [];
    }

    // Start with personalized data (already properly formatted as separate entries)
    let combinedResult = [];

    if (personalizedData) {
      combinedResult = [...personalizedData]; // Keep existing personalized entries as-is
    }

    // Add packing-message entries (now separate entries from packing-message.js changes)
    if (packingMessageData && packingMessageData.length > 0) {
      console.log(`🎯 DEBUG: Processing ${packingMessageData.length} packing-message items`);
      packingMessageData.forEach((item, idx) => {
        const hasMessageCards = item.message_cards_data !== undefined;
        const hasPackingSlips = item.packing_slips_data !== undefined;
        console.log(`   Item ${idx}: location=${item.location}, has message_cards_data=${hasMessageCards}, has packing_slips_data=${hasPackingSlips}`);
        combinedResult.push(JSON.stringify(item)); // Convert to JSON string for consistency
      });
    }

    console.log(`🎯 DEBUG: Combined ${personalizedData ? personalizedData.length : 0} personalized items with ${packingMessageData ? packingMessageData.length : 0} packing-message items into ${combinedResult.length} total items`);

    // Count message_cards_data entries in final result
    const messageCardEntries = combinedResult.filter(entry => {
      try {
        const parsed = typeof entry === 'string' ? JSON.parse(entry) : entry;
        return parsed.message_cards_data !== undefined;
      } catch {
        return false;
      }
    });
    console.log(`🎯 DEBUG: Final result contains ${messageCardEntries.length} entries with message_cards_data`);

    return combinedResult;
  }

  static formatForZapier(results) {
    console.log('Applying Zapier formatting...');
    
    // Convert orders data to the expected format (array of order_number strings)
    if (results.orders && Array.isArray(results.orders)) {
      const orderNumbersOnly = results.orders.map(orderData => orderData.order_number);
      results.orders = JSON.stringify(orderNumbersOnly);
    }
    
    // Stringify gopeople results
    if (results.gopeople) {
      results.gopeople = JSON.stringify(results.gopeople);
    }
    
    // Format personalized_packingslip_notes data - already has batch info added above
    if (results.personalized_packingslip_notes && Array.isArray(results.personalized_packingslip_notes)) {
      // Results are already formatted as JSON strings with batch info
    }
    
    // Stringify fos_update results
    if (results.fos_update) {
      results.fos_update = JSON.stringify(results.fos_update);
    }

    // Stringify personalized_api_service results
    if (results.personalized_api_service) {
      results.personalized_api_service = JSON.stringify(results.personalized_api_service);
    }

    // Stringify gp_labels_api_service results
    if (results.gp_labels_api_service) {
      results.gp_labels_api_service = JSON.stringify(results.gp_labels_api_service);
    }

    return results;
  }

  static formatResponse({
    success,
    successCount,
    failureCount,
    overallExecutionTime,
    requestParams,
    orderTrackingArray,
    deliveryDate,
    currentBatchNumbers,
    finalBatchNumbers,
    locationSummary,
    executionDetails,
    results,
    folderPreCreationResults,
    polaroidProcessingResults,
    personalizedApiResults,
    gpLabelsApiResults,
    googleSheetsResults,
    SCRIPTS_CONFIG,
    isZapierRequest = false
  }) {
    // Extract GP labels data for response
    let gpPrintingLabels = null;
    if (gpLabelsApiResults && gpLabelsApiResults.gpLabelsData) {
      // Convert to stringified JSON as requested
      gpPrintingLabels = JSON.stringify(gpLabelsApiResults.gpLabelsData);
    }

    // Extract batch details from Google Sheets results
    let batchDetails = null;
    if (googleSheetsResults && googleSheetsResults.successCount > 0 && results['google_sheets_write'] && results['google_sheets_write'].batchDetails) {
      batchDetails = results['google_sheets_write'].batchDetails;
    }

    // Apply Zapier formatting if needed
    if (isZapierRequest) {
      results = ResponseFormatter.formatForZapier(results);
    }

    return {
      success: successCount > 0,
      message: `Executed ${successCount + failureCount} scripts`,
      totalScripts: Object.keys(SCRIPTS_CONFIG).length,
      successCount,
      failureCount,
      overallExecutionTime,
      timestamp: new Date().toISOString(),
      requestParams: {
        ...requestParams,
        orderNumbersFound: orderTrackingArray.length
      },
      batchInfo: {
        deliveryDate: deliveryDate,
        initialBatchNumbers: currentBatchNumbers,
        finalBatchNumbers: finalBatchNumbers,
        locationOrderCounts: locationSummary || {}
      },
      executionDetails,
      // data: results,
      // gp_printing_labels: gpPrintingLabels,
      // folderPreCreation: folderPreCreationResults,
      // polaroidProcessing: polaroidProcessingResults,
      // personalizedApiService: personalizedApiResults,
      gpLabelsApiService: gpLabelsApiResults,
      // googleSheetsWrite: googleSheetsResults,
      overall: orderTrackingArray,
      batchDetails: batchDetails
    };
  }
}

module.exports = ResponseFormatter;