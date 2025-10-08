const query = `
SELECT
    so.id,
    so.order_number,
    so.process_status,
    so.shop_id,
    sfl.location_name,
    sode.delivery_date,
    (SELECT GROUP_CONCAT(DISTINCT sp2.title ORDER BY sp2.title SEPARATOR ', ') FROM shopify_order_products sop2 LEFT JOIN shopify_products sp2 ON sp2.variant_id = sop2.variant_id WHERE sop2.order_id = so.id) as order_products
FROM (
    SELECT
        so.id,
        so.order_number,
        so.process_status,
        so.shop_id,
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
        so.shop_id IN (PLACEHOLDER_SHOP_IDS)
        AND sode.delivery_date = 'PLACEHOLDER_DELIVERY_DATE'
        AND so.process_status IS NULL
        AND sode.is_same_day = PLACEHOLDER_IS_SAME_DAY
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

    // Create array of objects with id, store, order_number, location, shop_id, and order_products
    const orderData = rawData
        .filter(row => row.id && row.order_number && row.location_name) // Filter out any null/undefined values
        .map(row => ({
            id: row.id,  // Include unique database ID for filtering
            store: row.shop_id === 10 ? 'LVLY' : row.shop_id === 6 ? 'BL' : '',
            order_number: row.order_number,
            location: row.location_name,
            shop_id: row.shop_id,
            order_products: row.order_products || '' // Include order_products, default to empty string if null
        }))
        .filter((orderData, index, array) =>
            // Remove duplicates based on id (which is unique)
            array.findIndex(item => item.id === orderData.id) === index
        );

    console.log('Orders Transform: Processed', orderData.length, 'unique orders');

    // Log location breakdown for debugging
    const locationBreakdown = orderData.reduce((acc, order) => {
        acc[order.location] = (acc[order.location] || 0) + 1;
        return acc;
    }, {});

    // Log store breakdown for debugging
    const storeBreakdown = orderData.reduce((acc, order) => {
        const storeName = order.shop_id === 10 ? 'LVLY' : order.shop_id === 6 ? 'Bloomeroo' : 'Unknown';
        acc[storeName] = (acc[storeName] || 0) + 1;
        return acc;
    }, {});
    console.log('Orders Transform: Store breakdown:', storeBreakdown);

    return orderData;
}

module.exports = {
    query,
    transform
};