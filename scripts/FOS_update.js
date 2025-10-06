// FOS_update.js - Script to update process_status to true for specified orders

const query = `
UPDATE flowerchimp.shopify_orders 
SET process_status = true 
WHERE order_number IN (PLACEHOLDER_ORDER_NUMBERS);
`;

// Transform function - returns processed order numbers for tracking
function transform(rawData, orderNumbers) {
    console.log('FOS_update transform called with orderNumbers length:', orderNumbers ? orderNumbers.length : 'null/undefined');
    console.log('Raw data (update result):', rawData);
    
    if (!orderNumbers || orderNumbers.length === 0) {
        console.log('No order numbers provided for FOS update');
        return {
            processedOrderNumbers: [],
            updateResult: rawData
        };
    }
    
    // Check if the update was successful
    // rawData should contain the MySQL update result with affectedRows
    const affectedRows = rawData && rawData.affectedRows ? rawData.affectedRows : 0;
    console.log(`FOS_update: ${affectedRows} rows affected out of ${orderNumbers.length} orders`);
    
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
    query,
    transform
};