const query = `
SELECT 
    so.shop_id,
    so.id, 
    so.order_number, 
    so.process_status, 
    sfl.location_name, 
    sode.packer_note as packers_note,
    sode.delivery_date,
    JSON_ARRAYAGG(
        JSON_OBJECT(
            'title', sp.title,
            'variant_sku', sp.variant_sku,
            'sku', sp.variant_sku,
            'quantity', sop.quantity,
            'qty', sop.quantity,
            'src', spi.src,
            'image1', spi.src,
            'properties',sop.properties,
            'ingredients', (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
					'qty', TRIM(TRAILING '0' FROM TRIM(TRAILING '.' FROM CAST(cb.qty AS CHAR))),
					'title', CASE 
						WHEN cb.bundle_product_id IS NULL OR cb.bundle_product_id = 0 
							THEN cbi.ingredient_name
							ELSE (
								SELECT sp2.title
								FROM shopify_products sp2
								WHERE sp2.id = cb.bundle_product_id
							)
					END
					)
                )
                FROM cookbook cb
                LEFT JOIN cookbook_ingredient cbi ON cbi.ingredient_id = cb.ingredient_id
                WHERE cb.product_id = sp.id
            )
        )
    ) as products,
    sode.recipient_name,
    so.note,
    sode.sender_name as from_sender,
    sos.name as to_recipient,
    CASE 
        WHEN sos.address2 IS NOT NULL AND sos.address2 != '' 
        THEN CONCAT(sos.address1, ', ', sos.address2)
        ELSE sos.address1
    END AS address
    
FROM flowerchimp.shopify_orders so
LEFT JOIN 
    shopify_order_shipping sos ON sos.order_id = so.id
LEFT JOIN 
    shopify_order_additional_details sode ON so.id = sode.order_id
LEFT JOIN 
    shopify_fulfillment_locations sfl ON so.fulfillment_location_id = sfl.id
LEFT JOIN 
    shopify_order_products sop ON so.id = sop.order_id
LEFT JOIN 
    shopify_products sp ON sp.variant_id = sop.variant_id
LEFT JOIN
    shopify_product_image spi ON spi.shopify_product_variant_id = sp.variant_id
WHERE  sode.delivery_date = ?
GROUP BY 
    so.id, 
    so.order_number, 
    so.process_status, 
    sfl.location_name, 
    sode.delivery_date,
    sode.packer_note,
    sode.recipient_name,
    so.note,
    sode.sender_name,
    sos.name,
    sos.address1,
    sos.address2
ORDER BY sfl.location_name, so.created_at DESC;
`;

// Transform function that handles both packing slips and message cards
function transform(rawData, finalBatchNumbers) {
    console.log('Packing-Message Transform called with rawData length:', rawData ? rawData.length : 'null/undefined');
    
    if (!rawData || rawData.length === 0) {
        console.log('No raw data provided for packing-message');
        return {
            transformedData: [],
            processedOrderNumbers: []
        };
    }
    
    // Fixed location order: Sydney, Melbourne, Perth, Adelaide, Brisbane
    const validLocations = ["Sydney", "Melbourne", "Perth", "Adelaide", "Brisbane"];
    
    // Process both packing slips and message cards
    const packingSlipsResult = transformPackingSlips(rawData, validLocations, finalBatchNumbers);
    const messageCardsResult = transformMessageCards(rawData, validLocations, finalBatchNumbers);
    
    console.log('Packing slips locations:', Object.keys(packingSlipsResult.data).length);
    console.log('Message cards locations:', Object.keys(messageCardsResult.data).length);
    
    // Combine both results per location
    const combinedData = combinePackingAndMessage(
        packingSlipsResult.data, 
        messageCardsResult.data, 
        validLocations
    );
    
    // Combine all processed order numbers
    const processedOrderNumbers = [
        ...packingSlipsResult.orderNumbers,
        ...messageCardsResult.orderNumbers
    ];
    
    // Remove duplicates
    const uniqueProcessedOrderNumbers = [...new Set(processedOrderNumbers.filter(orderNum => orderNum))];
    
    console.log('Final combined packing-message result length:', combinedData.length);
    console.log('Actually processed order numbers:', uniqueProcessedOrderNumbers.length);
    
    return {
        transformedData: combinedData,
        processedOrderNumbers: uniqueProcessedOrderNumbers
    };
}

function transformPackingSlips(rawData, validLocations, finalBatchNumbers) {
    console.log('Processing packing slips data - input length:', rawData.length);
    
    const locationGroups = {};
    const processedOrderNumbers = [];
    
    // Initialize all locations
    validLocations.forEach(location => {
        locationGroups[location] = [];
    });
    
    // Group orders by location
    rawData.forEach((row, index) => {
        if (row.location_name && validLocations.includes(row.location_name)) {
            // Parse products JSON
            let products = [];
            try {
                products = typeof row.products === 'string' ? JSON.parse(row.products) : row.products;
                if (!Array.isArray(products)) {
                    products = [];
                }
            } catch (error) {
                console.error('Error parsing products for packing slip:', error);
                products = [];
            }
            
            // Create packing slip object
            const packingSlipOrder = {
                shop_id: row.shop_id,
                order_number: row.order_number,
                packers_note: row.packers_note || null,
                delivery_date: row.delivery_date,
                products: products,
                recipient_name: row.to_recipient || null,
                note: row.note || null,
                from: row.from_sender || null,
                to: row.recipient_name || null,
                address: row.address || null
            };
            
            locationGroups[row.location_name].push(packingSlipOrder);
            
            // Add to processed orders
            if (row.order_number) {
                processedOrderNumbers.push(row.order_number);
            }
            
            if (index < 3) {
                console.log(`Sample packing slip ${index}: location=${row.location_name}, order=${row.order_number}`);
            }
        }
    });
    
    // Transform to final structure (no batching)
    const result = {};
    
    validLocations.forEach(locationName => {
        const orders = locationGroups[locationName] || [];
        
        if (orders.length > 0) {
            console.log(`${locationName}: ${orders.length} packing slip orders`);
            
            result[locationName] = {
                packing_slips_data: orders
            };
        }
    });
    
    return {
        data: result,
        orderNumbers: processedOrderNumbers
    };
}

function transformMessageCards(rawData, validLocations, finalBatchNumbers) {
    console.log('Processing message cards data - input length:', rawData.length);

    const locationGroups = {};
    const processedOrderNumbers = [];

    // Initialize all locations
    validLocations.forEach(location => {
        locationGroups[location] = [];
    });

    // Group message cards by location
    rawData.forEach((row, index) => {
        if (row.location_name && validLocations.includes(row.location_name)) {
            // Only include orders that have a note/message
            if (row.note && row.note.trim() !== '') {
                const messageCard = {
                    order_number: row.order_number,
                    from: row.from_sender || null,
                    note: row.note || null,
                    to: row.recipient_name || null
                };

                locationGroups[row.location_name].push(messageCard);

                // Add to processed orders
                if (row.order_number) {
                    processedOrderNumbers.push(row.order_number);
                }

                if (index < 3) {
                    console.log(`Sample message card ${index}: location=${row.location_name}, order=${row.order_number}, note="${row.note ? row.note.substring(0, 30) : 'null'}..."`);
                }
            }
        }
    });

    // Transform to final structure with batching (batch size 12)
    const result = {};

    validLocations.forEach(locationName => {
        const messages = locationGroups[locationName] || [];

        if (messages.length > 0) {
            console.log(`${locationName}: ${messages.length} message cards`);

            const batches = [];

            for (let i = 0; i < messages.length; i += 12) {
                const batchMessages = messages.slice(i, i + 12);
                const batch = {};

                batchMessages.forEach((messageCard, index) => {
                    batch[`message_cards_data${index + 1}`] = messageCard;
                });

                batches.push(batch);
            }

            result[locationName] = {
                message_cards_data: batches
            };
        }
    });

    return {
        data: result,
        orderNumbers: processedOrderNumbers
    };
}

function combinePackingAndMessage(packingSlipsResult, messageCardsResult, validLocations) {
    const combinedResult = [];
    
    validLocations.forEach(locationName => {
        const locationPacking = packingSlipsResult[locationName];
        const locationMessages = messageCardsResult[locationName];
        
        // Add packing slips data as separate entry if exists
        if (locationPacking && locationPacking.packing_slips_data) {
            combinedResult.push({
                location: locationName,
                packing_slips_data: locationPacking.packing_slips_data
            });
        }
        
        // Add message cards data as separate entry if exists
        if (locationMessages && locationMessages.message_cards_data) {
            combinedResult.push({
                location: locationName,
                message_cards_data: locationMessages.message_cards_data
            });
        }
    });
    
    return combinedResult;
}

module.exports = {
    query,
    transform
};