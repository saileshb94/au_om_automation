const query = `
SELECT 
    so.id, 
    so.order_number, 
    so.process_status, 
    sfl.location_name, 
    sode.delivery_date
FROM (
    SELECT 
        so.id, 
        so.order_number, 
        so.process_status, 
        so.fulfillment_location_id,
        so.created_at,
        ROW_NUMBER() OVER (
            PARTITION BY sfl.location_name 
            ORDER BY 
                CASE sode.residence_type
                    WHEN 'Office/Business' THEN 1
                    WHEN 'Office/business' THEN 2
                    WHEN 'School' THEN 3
                    WHEN 'Hospital (patient)' THEN 4
                    WHEN 'Hospital (employee)' THEN 5
                    WHEN 'University (student residence)' THEN 6
                    WHEN 'University (staff)' THEN 7
                    WHEN 'Hotel/Retirement Village' THEN 8
                    WHEN 'House/Unit/Apartment' THEN 9
                    ELSE 10
                END,
                so.created_at DESC
        ) as rn
    FROM 
        flowerchimp.shopify_orders so
    LEFT JOIN 
        shopify_fulfillment_locations sfl ON so.fulfillment_location_id = sfl.id
    LEFT JOIN 
        shopify_order_additional_details sode ON so.id = sode.order_id
    WHERE 
        so.shop_id = 10 
        AND sode.delivery_date = '2025-09-02' 
        AND so.process_status IS NULL
        AND sode.is_same_day = 1
        AND sfl.location_name IN ('Melbourne', 'Sydney', 'Perth', 'Adelaide', 'Brisbane')
) ranked_orders
JOIN flowerchimp.shopify_orders so ON ranked_orders.id = so.id
LEFT JOIN 
    shopify_order_additional_details sode ON so.id = sode.order_id
LEFT JOIN 
    shopify_fulfillment_locations sfl ON so.fulfillment_location_id = sfl.id
WHERE 
    ranked_orders.rn <= 20
ORDER BY 
    sfl.location_name, so.created_at DESC;
`;

// Transform function to return both order numbers and locations
// This maintains the existing functionality while the location summary is generated in index.js
function transform(rawData) {
    console.log('Orders Transform: Processing', rawData.length, 'raw orders');
    
    // Create array of objects with order_number and location
    const orderData = rawData
        .filter(row => row.order_number && row.location_name) // Filter out any null/undefined values
        .map(row => ({
            order_number: row.order_number,
            location: row.location_name
        }))
        .filter((orderData, index, array) => 
            // Remove duplicates based on order_number
            array.findIndex(item => item.order_number === orderData.order_number) === index
        );
    
    console.log('Orders Transform: Processed', orderData.length, 'unique orders');
    
    // Log location breakdown for debugging
    const locationBreakdown = orderData.reduce((acc, order) => {
        acc[order.location] = (acc[order.location] || 0) + 1;
        return acc;
    }, {});
    // console.log('Orders Transform: Location breakdown:', locationBreakdown);
    
    return orderData;
}

module.exports = {
    query,
    transform
};