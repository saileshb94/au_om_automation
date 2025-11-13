// Personalized products script - processes jars, candles, plants, proseccos, and polaroids
const PropertyExtractor = require('../utils/PropertyExtractor');
const { getTemplateConfig } = require('../config');

const query = `
SELECT 
    so.id, 
    so.order_number, 
    so.process_status, 
    sfl.location_name, 
    sode.delivery_date, 
    sp.title, 
    sp.tags, 
    sop.properties,
    (SELECT GROUP_CONCAT(DISTINCT sp2.title ORDER BY sp2.title SEPARATOR ', ') FROM shopify_order_products sop2 LEFT JOIN shopify_products sp2 ON sp2.variant_id = sop2.variant_id WHERE sop2.order_id = so.id) as order_products
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
WHERE (sp.tags LIKE '%product:personalisedjar%' OR sp.tags LIKE '%product:personalisedcandle%' OR sp.tags LIKE '%product:personalisedplant%' OR sp.tags LIKE '%product:personalisedbottle%' OR sp.tags LIKE '%product:imageupload%' OR sp.tags LIKE '%product:personalisedbauble%')
ORDER BY sfl.location_name, so.created_at desc;
`;

// Transform function - updated to return both data and processed order numbers
function transform(rawData) {
    console.log('Transform called with rawData length:', rawData ? rawData.length : 'null/undefined');
    
    if (!rawData || rawData.length === 0) {
        console.log('No raw data provided');
        return {
            transformedData: [],
            processedOrderNumbers: []
        };
    }
    
    // Fixed location order: Sydney, Melbourne, Perth, Adelaide, Brisbane
    const validLocations = ["Sydney", "Melbourne", "Perth", "Adelaide", "Brisbane"];
    
    // Separate data by product type
    const jarData = rawData.filter(row => row.tags && row.tags.includes('product:personalisedjar'));
    const candlesPlantData = rawData.filter(row => row.tags && (row.tags.includes('product:personalisedcandle') || row.tags.includes('product:personalisedplant')));
    const proseccoData = rawData.filter(row => row.tags && row.tags.includes('product:personalisedbottle'));
    const baubleData = rawData.filter(row => row.tags && row.tags.includes('product:personalisedbauble'));
    const polaroidData = rawData.filter(row => row.tags && row.tags.includes('product:imageupload'));

    console.log('Filtered data counts - Jars:', jarData.length, 'Candles/Plants:', candlesPlantData.length, 'Proseccos:', proseccoData.length, 'Baubles:', baubleData.length, 'Polaroids:', polaroidData.length);
    
    // Process all product types
    const jarsResult = processJarsData(jarData, validLocations);
    const candlesPlantsResult = processCandlesPlantsData(candlesPlantData, validLocations);
    const proseccosResult = processProseccosData(proseccoData, validLocations);
    const baubleResult = processBaubleData(baubleData, validLocations);
    const polaroidResult = processPolaroidData(polaroidData, validLocations);

    console.log('Processing results - Jars:', Object.keys(jarsResult.data).length, 'Candles/Plants:', Object.keys(candlesPlantsResult.data).length, 'Proseccos:', Object.keys(proseccosResult.data).length, 'Baubles:', Object.keys(baubleResult.data).length, 'Polaroids:', Object.keys(polaroidResult.data).length, 'locations');
    
    // Combine all product types into a single personalized result
    const transformedData = combinePersonalizedData(
        jarsResult.data,
        candlesPlantsResult.data,
        proseccosResult.data,
        baubleResult.data,
        polaroidResult.data,
        validLocations
    );

    // Combine all processed order numbers from all product types
    const processedOrderNumbers = [
        ...jarsResult.orderNumbers,
        ...candlesPlantsResult.orderNumbers,
        ...proseccosResult.orderNumbers,
        ...baubleResult.orderNumbers,
        ...polaroidResult.orderNumbers
    ];
    
    // Remove duplicates and filter out any null/undefined values
    const uniqueProcessedOrderNumbers = [...new Set(processedOrderNumbers.filter(orderNum => orderNum))];
    
    console.log('Final combined result length:', transformedData.length);
    console.log('Actually processed order numbers:', uniqueProcessedOrderNumbers.length);
    
    return {
        transformedData,
        processedOrderNumbers: uniqueProcessedOrderNumbers
    };
}

// Utility functions now moved to PropertyExtractor

function processJarsData(rawData, validLocations) {
    console.log('Processing jars data - input length:', rawData.length);
    
    const locationGroups = {};
    const processedOrderNumbers = [];
    
    // Initialize all locations with empty arrays for both luxe and classic/large
    validLocations.forEach(location => {
        locationGroups[location] = {
            luxe: [],
            classic_large: []
        };
    });
    
    // Group messages by location and type (luxe vs classic/large)
    rawData.forEach((row, index) => {
        const messageValue = PropertyExtractor.extractJarMessage(row.properties);
        
        if (messageValue && messageValue.trim() !== '' && row.location_name) {
            const locationName = row.location_name;
            
            // Only process valid locations
            if (validLocations.includes(locationName)) {
                // Clean up the message value
                const cleanMessage = messageValue.replace(/\s+/g, ' ').trim();
                
                // Check if order_products contains "Luxe" or "luxe"
                const isLuxe = row.order_products && (row.order_products.includes('Luxe') || row.order_products.includes('luxe'));
                
                if (isLuxe) {
                    locationGroups[locationName].luxe.push(cleanMessage);
                } else {
                    locationGroups[locationName].classic_large.push(cleanMessage);
                }
                
                // Add this order number to processed list since we used its message
                if (row.order_number) {
                    processedOrderNumbers.push(row.order_number);
                }
                
                if (index < 3) {
                    // console.log(`Sample jar ${index}: location=${locationName}, isLuxe=${isLuxe}, message="${cleanMessage.substring(0, 50)}..."`);
                }
            }
        }
    });
    
    // Transform to final structure with batching
    const result = {};
    
    validLocations.forEach(locationName => {
        const luxeMessages = locationGroups[locationName].luxe || [];
        const classicLargeMessages = locationGroups[locationName].classic_large || [];

        // console.log(`${locationName}: ${luxeMessages.length} luxe, ${classicLargeMessages.length} classic/large`);

        const locationData = {};

        // Process luxe messages with dynamic grouping
        if (luxeMessages.length > 0) {
            const luxeConfig = getTemplateConfig(locationName, 'jars_luxe');
            const groupingNumber = luxeConfig.groupingNumber || 2; // Default to 2 if not found

            console.log(`\n  📋 Jars Luxe Template Configuration for ${locationName}:`);
            console.log(`     Version: ${luxeConfig.version}`);
            console.log(`     Grouping Number: ${groupingNumber}`);
            console.log(`     Endpoint: ${luxeConfig.endpoint}`);

            const luxeBatches = [];

            for (let i = 0; i < luxeMessages.length; i += groupingNumber) {
                const batchMessages = luxeMessages.slice(i, i + groupingNumber);
                const batch = {};

                batchMessages.forEach((message, index) => {
                    batch[`jar_message${index + 1}`] = message;
                });

                luxeBatches.push(batch);
            }

            locationData.jars_luxe_data = luxeBatches;
        }

        // Process classic/large messages with dynamic grouping
        if (classicLargeMessages.length > 0) {
            const classicLargeConfig = getTemplateConfig(locationName, 'jars_classic_large');
            const groupingNumber = classicLargeConfig.groupingNumber || 2; // Default to 2 if not found

            console.log(`\n  📋 Jars Classic/Large Template Configuration for ${locationName}:`);
            console.log(`     Version: ${classicLargeConfig.version}`);
            console.log(`     Grouping Number: ${groupingNumber}`);
            console.log(`     Endpoint: ${classicLargeConfig.endpoint}`);

            const classicLargeBatches = [];

            for (let i = 0; i < classicLargeMessages.length; i += groupingNumber) {
                const batchMessages = classicLargeMessages.slice(i, i + groupingNumber);
                const batch = {};

                batchMessages.forEach((message, index) => {
                    batch[`jar_message${index + 1}`] = message;
                });

                classicLargeBatches.push(batch);
            }

            locationData.jars_classic_large_data = classicLargeBatches;
        }
        
        // Only add to result if there's data
        if (Object.keys(locationData).length > 0) {
            result[locationName] = locationData;
        }
    });
    
    return {
        data: result,
        orderNumbers: processedOrderNumbers
    };
}

function processCandlesPlantsData(rawData, validLocations) {
    const locationGroups = {};
    const processedOrderNumbers = [];
    
    validLocations.forEach(location => {
        locationGroups[location] = [];
    });
    
    rawData.forEach(order => {
        const messageValue = PropertyExtractor.extractCandlesPlantMessage(order.properties);
        
        if (messageValue && order.location_name) {
            const locationName = order.location_name;
            
            if (validLocations.includes(locationName)) {
                const cleanMessage = PropertyExtractor.cleanMessage(messageValue);
                
                locationGroups[locationName].push(cleanMessage);
                
                // Add this order number to processed list since we used its message
                if (order.order_number) {
                    processedOrderNumbers.push(order.order_number);
                }
            }
        }
    });
    
    const result = {};
    
    validLocations.forEach(locationName => {
        const messages = locationGroups[locationName] || [];

        if (messages.length > 0) {
            // Get dynamic grouping number for candles
            const candlesConfig = getTemplateConfig(locationName, 'candles');
            const groupingNumber = candlesConfig.groupingNumber || 12; // Default to 12 if not found

            console.log(`\n  📋 Candles Template Configuration for ${locationName}:`);
            console.log(`     Version: ${candlesConfig.version}`);
            console.log(`     Grouping Number: ${groupingNumber}`);
            console.log(`     Endpoint: ${candlesConfig.endpoint}`);

            const batches = [];

            for (let i = 0; i < messages.length; i += groupingNumber) {
                const batchMessages = messages.slice(i, i + groupingNumber);
                const batch = {};

                batchMessages.forEach((message, index) => {
                    batch[`candles_plants_message${index + 1}`] = message;
                });

                batches.push(batch);
            }

            result[locationName] = {
                candles_plants_data: batches
            };
        }
    });
    
    return {
        data: result,
        orderNumbers: processedOrderNumbers
    };
}

function processProseccosData(rawData, validLocations) {
    const locationGroups = {};
    const processedOrderNumbers = [];
    
    validLocations.forEach(location => {
        locationGroups[location] = [];
    });
    
    rawData.forEach(order => {
        const messageValue = PropertyExtractor.extractProseccoMessage(order.properties);
        
        if (messageValue && order.location_name) {
            const locationName = order.location_name;
            
            if (validLocations.includes(locationName)) {
                const cleanMessage = PropertyExtractor.cleanMessage(messageValue);
                
                locationGroups[locationName].push(cleanMessage);
                
                // Add this order number to processed list since we used its message
                if (order.order_number) {
                    processedOrderNumbers.push(order.order_number);
                }
            }
        }
    });
    
    const result = {};
    
    validLocations.forEach(locationName => {
        const messages = locationGroups[locationName] || [];

        if (messages.length > 0) {
            // Get dynamic grouping number for prosecco
            const proseccoConfig = getTemplateConfig(locationName, 'prosecco');
            const groupingNumber = proseccoConfig.groupingNumber || 6; // Default to 6 if not found

            console.log(`\n  📋 Prosecco Template Configuration for ${locationName}:`);
            console.log(`     Version: ${proseccoConfig.version}`);
            console.log(`     Grouping Number: ${groupingNumber}`);
            console.log(`     Endpoint: ${proseccoConfig.endpoint}`);

            const batches = [];

            for (let i = 0; i < messages.length; i += groupingNumber) {
                const batchMessages = messages.slice(i, i + groupingNumber);
                const batch = {};

                batchMessages.forEach((message, index) => {
                    batch[`prosecco_message${index + 1}`] = message;
                });

                batches.push(batch);
            }

            result[locationName] = {
                prosecco_data: batches
            };
        }
    });
    
    return {
        data: result,
        orderNumbers: processedOrderNumbers
    };
}

function processBaubleData(rawData, validLocations) {
    const locationGroups = {};
    const processedOrderNumbers = [];

    validLocations.forEach(location => {
        locationGroups[location] = [];
    });

    rawData.forEach(order => {
        const messageValue = PropertyExtractor.extractBaubleMessage(order.properties);

        if (messageValue && order.location_name) {
            const locationName = order.location_name;

            if (validLocations.includes(locationName)) {
                const cleanMessage = PropertyExtractor.cleanMessage(messageValue);

                locationGroups[locationName].push(cleanMessage);

                // Add this order number to processed list since we used its message
                if (order.order_number) {
                    processedOrderNumbers.push(order.order_number);
                }
            }
        }
    });

    const result = {};

    validLocations.forEach(locationName => {
        const messages = locationGroups[locationName] || [];

        if (messages.length > 0) {
            // Get dynamic grouping number for bauble
            const baubleConfig = getTemplateConfig(locationName, 'bauble');
            const groupingNumber = baubleConfig.groupingNumber || 6; // Default to 6 if not found

            console.log(`\n  📋 Bauble Template Configuration for ${locationName}:`);
            console.log(`     Version: ${baubleConfig.version}`);
            console.log(`     Grouping Number: ${groupingNumber}`);
            console.log(`     Endpoint: ${baubleConfig.endpoint}`);

            const batches = [];

            for (let i = 0; i < messages.length; i += groupingNumber) {
                const batchMessages = messages.slice(i, i + groupingNumber);
                const batch = {};

                batchMessages.forEach((message, index) => {
                    batch[`bauble_message${index + 1}`] = message;
                });

                batches.push(batch);
            }

            result[locationName] = {
                bauble_data: batches
            };
        }
    });

    return {
        data: result,
        orderNumbers: processedOrderNumbers
    };
}

// Polaroid processing - utility function moved to PropertyExtractor

// Process polaroid data similar to other personalized products
function processPolaroidData(rawData, validLocations) {
    const locationGroups = {};
    const processedOrderNumbers = [];
    
    validLocations.forEach(location => {
        locationGroups[location] = [];
    });
    
    rawData.forEach(order => {
        const imageUrl = PropertyExtractor.extractPolaroidMessage(order.properties);
        
        if (imageUrl && order.location_name && order.order_number) {
            const locationName = order.location_name;
            
            if (validLocations.includes(locationName)) {
                // Store URL, order number, and created_at for processing
                locationGroups[locationName].push({
                    url: imageUrl.trim(),
                    order_number: order.order_number,
                    created_at: order.created_at
                });
                
                // Add this order number to processed list since we used its image
                processedOrderNumbers.push(order.order_number);
            }
        }
    });
    
    const result = {};
    
    validLocations.forEach(locationName => {
        const images = locationGroups[locationName] || [];
        
        if (images.length > 0) {
            // No batching for polaroid photos - all images in one batch
            const batch = {};
            
            images.forEach((imageData, index) => {
                batch[`polaroid_url_${index + 1}`] = imageData.url;
                batch[`polaroid_order_${index + 1}`] = imageData.order_number;
                batch[`polaroid_created_${index + 1}`] = imageData.created_at;
            });
            
            result[locationName] = {
                polaroid_photo_data: [batch] // Array with single batch containing all images
            };
        }
    });
    
    return {
        data: result,
        orderNumbers: processedOrderNumbers
    };
}

function combinePersonalizedData(jarsResult, candlesPlantsResult, proseccosResult, baubleResult, polaroidResult, validLocations) {
    const combinedResult = [];

    validLocations.forEach(locationName => {
        const locationJars = jarsResult[locationName];
        const locationCandlesPlants = candlesPlantsResult[locationName];
        const locationProseccos = proseccosResult[locationName];
        const locationBaubles = baubleResult[locationName];
        const locationPolaroid = polaroidResult[locationName];
        
        // Add jars_luxe_data as separate line item if it exists
        if (locationJars && locationJars.jars_luxe_data) {
            combinedResult.push({
                location: locationName,
                jars_luxe_data: locationJars.jars_luxe_data
            });
        }
        
        // Add jars_classic_large_data as separate line item if it exists
        if (locationJars && locationJars.jars_classic_large_data) {
            combinedResult.push({
                location: locationName,
                jars_classic_large_data: locationJars.jars_classic_large_data
            });
        }
        
        // Add candles_plants_data as separate line item if it exists
        if (locationCandlesPlants && locationCandlesPlants.candles_plants_data) {
            combinedResult.push({
                location: locationName,
                candles_plants_data: locationCandlesPlants.candles_plants_data
            });
        }
        
        // Add prosecco_data as separate line item if it exists
        if (locationProseccos && locationProseccos.prosecco_data) {
            combinedResult.push({
                location: locationName,
                prosecco_data: locationProseccos.prosecco_data
            });
        }

        // Add bauble_data as separate line item if it exists
        if (locationBaubles && locationBaubles.bauble_data) {
            combinedResult.push({
                location: locationName,
                bauble_data: locationBaubles.bauble_data
            });
        }

        // Add polaroid_photo_data as separate line item if it exists
        if (locationPolaroid && locationPolaroid.polaroid_photo_data) {
            combinedResult.push({
                location: locationName,
                polaroid_photo_data: locationPolaroid.polaroid_photo_data
            });
        }
    });
    
    return combinedResult;
}

module.exports = {
    query,
    transform
};