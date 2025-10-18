// FOS_update.js - Script to update process_status for specified orders (using order IDs)
// Successful orders -> 'Processed', Unsuccessful orders -> 'Hold'

const querySuccessful = `
UPDATE flowerchimp.shopify_orders
SET process_status = 'Processed'
WHERE id IN (PLACEHOLDER_SUCCESSFUL_ORDER_IDS);
`;

const queryUnsuccessful = `
UPDATE flowerchimp.shopify_orders
SET process_status = 'Hold'
WHERE id IN (PLACEHOLDER_UNSUCCESSFUL_ORDER_IDS);
`;

// Transform function - returns processed order numbers for tracking
// Handles both successful and unsuccessful updates
function transform(rawData, orderNumbers, isSuccessful = true) {
    const updateType = isSuccessful ? 'Successful (Processed)' : 'Unsuccessful (Hold)';
    console.log(`FOS_update transform called for ${updateType} with orderNumbers length:`, orderNumbers ? orderNumbers.length : 'null/undefined');
    console.log('Raw data (update result):', rawData);

    if (!orderNumbers || orderNumbers.length === 0) {
        console.log(`No order numbers provided for FOS update (${updateType})`);
        return {
            processedOrderNumbers: [],
            updateResult: rawData
        };
    }

    // Check if the update was successful
    // rawData should contain the MySQL update result with affectedRows
    const affectedRows = rawData && rawData.affectedRows ? rawData.affectedRows : 0;
    console.log(`FOS_update (${updateType}): ${affectedRows} rows affected out of ${orderNumbers.length} order IDs`);

    // If update was successful, return the order numbers that were processed
    if (affectedRows > 0) {
        return {
            processedOrderNumbers: orderNumbers, // Return all order numbers as they should all be updated
            updateResult: rawData,
            affectedRows: affectedRows
        };
    } else {
        return {
            processedOrderNumbers: [],
            updateResult: rawData,
            affectedRows: 0
        };
    }
}

module.exports = {
    query: querySuccessful, // Keep 'query' for backward compatibility
    querySuccessful,
    queryUnsuccessful,
    transform
};