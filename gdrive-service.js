// Updated gdrive-service.js with folder pre-creation functionality

const { google } = require('googleapis');
const axios = require('axios');
const path = require('path');
const { GOOGLE_DRIVE_CONFIG } = require('./config');

class GoogleDriveService {
    constructor() {
        this.drive = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            if (!GOOGLE_DRIVE_CONFIG.credentialsJson) {
                throw new Error('Google Drive credentials not found in environment variables');
            }

            const credentials = JSON.parse(GOOGLE_DRIVE_CONFIG.credentialsJson);
            
            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/drive.file']
            });

            this.drive = google.drive({ version: 'v3', auth });
            this.initialized = true;
            console.log('Google Drive service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Google Drive service:', error.message);
            throw error;
        }
    }

    async findOrCreateFolder(parentId, folderName, retryCount = 0) {
        try {
            // Search for existing folder with Shared Drive support
            const searchQuery = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            console.log(`Searching for folder: "${folderName}" in parent: ${parentId}`);
            console.log(`Search query: ${searchQuery}`);

            const searchResponse = await this.drive.files.list({
                q: searchQuery,
                fields: 'files(id, name)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true
            });

            console.log(`Search returned ${searchResponse.data.files.length} result(s)`);

            if (searchResponse.data.files.length > 0) {
                console.log(`Found existing folder: ${folderName} (ID: ${searchResponse.data.files[0].id})`);
                return searchResponse.data.files[0].id;
            }

            // Create new folder if it doesn't exist
            const createResponse = await this.drive.files.create({
                requestBody: {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [parentId]
                },
                fields: 'id',
                supportsAllDrives: true
            });

            console.log(`Created new folder: ${folderName}`);
            return createResponse.data.id;
        } catch (error) {
            console.error(`Error finding/creating folder ${folderName}:`, error.message);
            
            // Retry logic for folder creation
            if (retryCount === 0) {
                console.log(`Retrying folder creation for ${folderName}...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                return this.findOrCreateFolder(parentId, folderName, retryCount + 1);
            }
            
            throw error;
        }
    }

    async preCreateFolderStructure(successfulOrders, deliveryDate, batchNumbers, isSameDay) {
        if (!this.initialized) {
            await this.initialize();
        }

        const results = {
            success: true,
            createdFolders: [],
            failedFolders: [],
            summary: {
                totalLocations: 0,
                successfulCreations: 0,
                failedCreations: 0
            }
        };

        try {
            // Determine delivery type based on isSameDay parameter
            const deliveryType = isSameDay === '1' ? 'same-day' : 'next-day';

            // Extract unique locations from successful orders
            const uniqueLocations = [...new Set(
                successfulOrders
                    .filter(order => order.location)
                    .map(order => order.location)
            )];

            results.summary.totalLocations = uniqueLocations.length;
            console.log(`Pre-creating folder structure for ${uniqueLocations.length} locations on ${deliveryDate} (${deliveryType})`);

            for (const location of uniqueLocations) {
                const batchNumber = batchNumbers[location];

                if (batchNumber === undefined || batchNumber === null) {
                    console.log(`No batch number for location: ${location}, skipping folder pre-creation`);
                    results.failedFolders.push({
                        location: location,
                        reason: 'No batch number available',
                        error: null
                    });
                    results.summary.failedCreations++;
                    continue;
                }

                try {
                    console.log(`Creating folder structure for ${location}, batch ${batchNumber} (${deliveryType})`);

                    // Create folder structure: main -> location -> delivery_date -> batch_number_delivery-type
                    const locationFolderId = await this.findOrCreateFolder(
                        GOOGLE_DRIVE_CONFIG.mainFolderId,
                        location
                    );

                    const dateFolderId = await this.findOrCreateFolder(
                        locationFolderId,
                        deliveryDate
                    );

                    const batchFolderName = `Batch_${batchNumber}_${deliveryType}`;
                    const batchFolderId = await this.findOrCreateFolder(
                        dateFolderId,
                        batchFolderName
                    );

                    const folderPath = `${location}/${deliveryDate}/${batchFolderName}`;
                    
                    results.createdFolders.push({
                        location: location,
                        batch: batchNumber,
                        folderPath: folderPath,
                        locationFolderId: locationFolderId,
                        dateFolderId: dateFolderId,
                        batchFolderId: batchFolderId
                    });
                    
                    results.summary.successfulCreations++;
                    console.log(`Successfully created folder structure: ${folderPath}`);
                    
                } catch (error) {
                    console.error(`Failed to create folder structure for ${location}:`, error.message);
                    
                    results.failedFolders.push({
                        location: location,
                        batch: batchNumber,
                        reason: 'Folder creation failed after retry',
                        error: error.message
                    });
                    
                    results.summary.failedCreations++;
                    // Continue with other locations even if one fails
                }
            }

            // Update overall success status
            results.success = results.summary.failedCreations === 0;
            
            console.log(`Folder pre-creation completed: ${results.summary.successfulCreations} success, ${results.summary.failedCreations} failed`);
            
            return results;

        } catch (error) {
            console.error('Error in preCreateFolderStructure:', error.message);
            results.success = false;
            results.error = error.message;
            return results;
        }
    }

    async downloadImage(url) {
        try {
            console.log(`Downloading image from: ${url.substring(0, 100)}...`);
            
            // Use stream mode to avoid loading entire image into memory
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream',
                timeout: GOOGLE_DRIVE_CONFIG.imageSettings.downloadTimeout,
                maxContentLength: GOOGLE_DRIVE_CONFIG.imageSettings.maxFileSize,
                maxBodyLength: GOOGLE_DRIVE_CONFIG.imageSettings.maxFileSize,
                // Add compression headers to potentially reduce size
                headers: {
                    'Accept-Encoding': 'gzip, deflate, br'
                }
            });

            const detectedContentType = response.headers['content-type'] || 'image/jpeg';
            console.log(`=== DOWNLOAD DEBUG ===`);
            console.log(`URL: ${url.substring(0, 100)}...`);
            console.log(`Response Status: ${response.status}`);
            console.log(`Content-Type Header: "${response.headers['content-type']}"`);
            console.log(`Detected Content-Type: "${detectedContentType}"`);
            console.log(`Content-Length: ${response.headers['content-length']}`);
            console.log(`All Response Headers:`, Object.keys(response.headers));
            console.log(`=== END DOWNLOAD DEBUG ===`);

            return {
                stream: response.data,
                contentType: detectedContentType,
                contentLength: response.headers['content-length']
            };
        } catch (error) {
            console.error(`Error downloading image from ${url}:`, error.message);
            throw error;
        }
    }

    // Extract direct image URL from different URL types for test function only
    async extractDirectImageUrl(originalUrl, orderCreatedAt) {
        console.log(`=== URL PROCESSING START ===`);
        console.log(`Original URL: ${originalUrl}`);
        console.log(`Order created at: ${orderCreatedAt}`);

        try {
            // Type 1: upcdn.io URLs - already direct image files
            if (originalUrl.includes('upcdn.io')) {
                console.log(`✓ upcdn.io URL detected - direct image file`);
                console.log(`Direct URL: ${originalUrl}`);
                console.log(`=== URL PROCESSING END ===`);
                return originalUrl;
            }

            // Type 2: cdn.shopify.com URLs - construct direct URL
            if (originalUrl.includes('cdn.shopify.com')) {
                console.log(`✓ Shopify CDN URL detected - constructing direct URL`);

                const directUrl = await this.constructShopifyDirectUrl(originalUrl, orderCreatedAt);
                console.log(`✓ Constructed direct URL: ${directUrl}`);
                console.log(`=== URL PROCESSING END ===`);
                return directUrl;
            }

            // If no patterns match, return original URL
            console.log(`✗ Unknown URL type - using original URL`);
            console.log(`=== URL PROCESSING END ===`);
            return originalUrl;

        } catch (error) {
            console.log(`✗ Error during URL processing: ${error.message}`);
            console.log(`✓ Falling back to original URL`);
            console.log(`=== URL PROCESSING END ===`);
            return originalUrl;
        }
    }

    // Convert Shopify CDN URL using PHP-style conversion for test function only
    async constructShopifyDirectUrl(pageUrl, orderCreatedAt) {
        console.log(`=== SHOPIFY URL CONVERSION START ===`);
        console.log(`Input URL: ${pageUrl}`);

        try {
            // Parse the URL and its query string
            const urlObj = new URL(pageUrl);
            const queryParams = urlObj.searchParams;

            console.log(`✓ Parsed URL successfully`);
            console.log(`Query parameters found: ${Array.from(queryParams.keys()).join(', ')}`);

            // Extract values following PHP logic
            const name = queryParams.get('ph_image') || '';
            const originalRaw = queryParams.get('ph_name') || '';
            const extensionRaw = queryParams.get('extension') || '';

            console.log(`✓ Raw parameters extracted:`);
            console.log(`  ph_image (name): ${name}`);
            console.log(`  ph_name (originalRaw): ${originalRaw}`);
            console.log(`  extension (extensionRaw): ${extensionRaw}`);

            if (!name) {
                console.log(`✗ No ph_image parameter found in URL`);
                throw new Error('No ph_image parameter found in URL');
            }

            // Convert ph_name: remove all non-alphanumeric characters
            const original = originalRaw.replace(/[^A-Za-z0-9]/g, '');
            console.log(`✓ Cleaned ph_name: "${originalRaw}" → "${original}"`);

            // Determine extension: remove equals signs (handle cases like j=p=e=g)
            const ext = extensionRaw.replace(/=/g, '');
            console.log(`✓ Cleaned extension: "${extensionRaw}" → "${ext}"`);

            // Check if crop is in the path
            const hasCrop = urlObj.pathname.includes('/crop/');
            const is_crop = hasCrop ? 'true' : 'false';
            console.log(`✓ Crop detection: path="${urlObj.pathname}" → is_crop="${is_crop}"`);

            // Define the shop manually
            const shop = 'ltg-lvly-au2.myshopify.com';
            console.log(`✓ Shop set to: ${shop}`);

            // Build final URL
            const finalUrl = `https://uploadly-filename.com/index.php?name=${encodeURIComponent(name)}&ext=${encodeURIComponent(ext)}&original=${encodeURIComponent(original)}&is_crop=${is_crop}&shop=${encodeURIComponent(shop)}`;

            console.log(`✓ Final converted URL: ${finalUrl}`);
            console.log(`=== SHOPIFY URL CONVERSION END ===`);
            return finalUrl;

        } catch (error) {
            console.log(`✗ Error converting Shopify URL: ${error.message}`);
            console.log(`=== SHOPIFY URL CONVERSION END ===`);
            throw error;
        }
    }


    // New blob-based image download specifically for test function
    async downloadImageAsBlob(url) {
        try {
            console.log(`Downloading image as blob from: ${url.substring(0, 100)}...`);

            // Use blob response type instead of stream to get complete binary data
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'arraybuffer', // Get raw binary data
                timeout: GOOGLE_DRIVE_CONFIG.imageSettings.downloadTimeout,
                maxContentLength: GOOGLE_DRIVE_CONFIG.imageSettings.maxFileSize,
                maxBodyLength: GOOGLE_DRIVE_CONFIG.imageSettings.maxFileSize,
                headers: {
                    'Accept': 'image/*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const detectedContentType = response.headers['content-type'] || 'image/jpeg';
            console.log(`=== BLOB DOWNLOAD DEBUG ===`);
            console.log(`URL: ${url.substring(0, 100)}...`);
            console.log(`Response Status: ${response.status}`);
            console.log(`Content-Type Header: "${response.headers['content-type']}"`);
            console.log(`Detected Content-Type: "${detectedContentType}"`);
            console.log(`Content-Length: ${response.headers['content-length']}`);
            console.log(`Data Buffer Length: ${response.data.length}`);
            console.log(`=== END BLOB DOWNLOAD DEBUG ===`);

            // Convert ArrayBuffer to Buffer for Node.js stream compatibility
            const buffer = Buffer.from(response.data);

            // Create a readable stream from the buffer
            const { Readable } = require('stream');
            const stream = new Readable({
                read() {
                    this.push(buffer);
                    this.push(null); // End the stream
                }
            });

            return {
                stream: stream,
                contentType: detectedContentType,
                contentLength: buffer.length
            };
        } catch (error) {
            console.error(`Error downloading image as blob from ${url}:`, error.message);
            throw error;
        }
    }

    async uploadImageToFolder(folderId, fileName, imageStream, contentType) {
        try {
            console.log(`Uploading image: ${fileName} to folder: ${folderId}`);

            const response = await this.drive.files.create({
                requestBody: {
                    name: fileName,
                    parents: [folderId]
                },
                media: {
                    mimeType: contentType,
                    body: imageStream
                },
                fields: 'id, name, webViewLink',
                supportsAllDrives: true
            });

            console.log(`Successfully uploaded: ${fileName}`);
            return {
                fileId: response.data.id,
                fileName: response.data.name,
                webViewLink: response.data.webViewLink
            };
        } catch (error) {
            console.error(`Error uploading image ${fileName}:`, error.message);
            throw error;
        }
    }

    getFileExtensionFromUrl(url) {
        try {
            // Extract extension from URL path
            const urlPath = new URL(url).pathname;
            let extension = path.extname(urlPath).toLowerCase();

            // If no extension found in URL path, try to extract from query parameters
            if (!extension) {
                const urlObj = new URL(url);
                const pathWithQuery = urlObj.pathname + urlObj.search;

                // Look for common image file patterns in the full URL
                const imageExtensionMatch = pathWithQuery.match(/\.(jpe?g|png|gif|webp|bmp|heic|heif)/i);
                if (imageExtensionMatch) {
                    extension = '.' + imageExtensionMatch[1].toLowerCase();
                }
            }

            // Normalize common variations
            if (extension === '.jpeg') extension = '.jpg';

            // Validate against supported formats
            if (extension && GOOGLE_DRIVE_CONFIG.imageSettings.supportedFormats.includes(extension)) {
                console.log(`Detected file extension: ${extension} from URL`);
                return extension;
            }

            console.log(`Unsupported or unknown extension (${extension}), defaulting to .jpg`);
            return '.jpg'; // Default fallback
        } catch (error) {
            console.error('Error extracting file extension:', error.message);
            return '.jpg';
        }
    }

    getMimeTypeFromExtension(extension) {
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.heic': 'image/heic',
            '.heif': 'image/heif'
        };

        return mimeTypes[extension] || 'image/jpeg';
    }

    async processPolaroidImages(personalizedData, deliveryDate, batchNumbers, isSameDay) {
        if (!this.initialized) {
            await this.initialize();
        }

        const results = [];
        let successCount = 0;
        let failureCount = 0;

        try {
            // Determine delivery type based on isSameDay parameter
            const deliveryType = isSameDay === '1' ? 'same-day' : 'next-day';

            for (const locationData of personalizedData) {
                if (!locationData.polaroid_photo_data) continue;

                const location = locationData.location;
                const batchNumber = batchNumbers[location];

                if (batchNumber === undefined || batchNumber === null) {
                    console.log(`No batch number for location: ${location}, skipping polaroid processing`);
                    continue;
                }

                console.log(`Processing polaroid images for ${location}, batch ${batchNumber} (${deliveryType})`);

                // Folders should already exist from pre-creation, but use findOrCreateFolder
                // to ensure they exist (will just find them if already created)
                const locationFolderId = await this.findOrCreateFolder(
                    GOOGLE_DRIVE_CONFIG.mainFolderId,
                    location
                );

                const dateFolderId = await this.findOrCreateFolder(
                    locationFolderId,
                    deliveryDate
                );

                const batchFolderName = `Batch_${batchNumber}_${deliveryType}`;
                const batchFolderId = await this.findOrCreateFolder(
                    dateFolderId,
                    batchFolderName
                );

                // Process each polaroid batch (should be only one batch with all images)
                for (const batch of locationData.polaroid_photo_data) {
                    const batchResults = {
                        location: location,
                        batch: batchNumber,
                        images: []
                    };

                    // Get all image URLs and process in batches to manage memory
                    const imageKeys = Object.keys(batch).filter(key => key.startsWith('polaroid_url_'));
                    const batchSize = GOOGLE_DRIVE_CONFIG.imageSettings.batchProcessingSize || 3;
                    
                    console.log(`Processing ${imageKeys.length} images in batches of ${batchSize}`);

                    // Process images in smaller batches to avoid memory overload
                    for (let i = 0; i < imageKeys.length; i += batchSize) {
                        const currentBatch = imageKeys.slice(i, i + batchSize);
                        
                        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(imageKeys.length/batchSize)}`);
                        
                        // Process current batch of images
                        await Promise.all(currentBatch.map(async (urlKey) => {
                            const imageUrl = batch[urlKey];
                            const orderKey = urlKey.replace('polaroid_url_', 'polaroid_order_');
                            const createdKey = urlKey.replace('polaroid_url_', 'polaroid_created_');
                            const orderNumber = batch[orderKey];
                            const orderCreatedAt = batch[createdKey];

                            if (!imageUrl || !orderNumber) return;

                            try {
                                console.log(`\n=== PROCESSING PRODUCTION IMAGE ===`);
                                console.log(`Order: ${orderNumber}`);
                                console.log(`Original URL: ${imageUrl.substring(0, 100)}...`);
                                console.log(`Created at: ${orderCreatedAt}`);

                                // Extract direct image URL based on URL type (same logic as test function)
                                const directImageUrl = await this.extractDirectImageUrl(imageUrl, orderCreatedAt);
                                console.log(`Using URL for download: ${directImageUrl.substring(0, 100)}...`);

                                // Download the image using blob method (same as test function)
                                const { stream, contentType } = await this.downloadImageAsBlob(directImageUrl);

                                // Extract extension from the final direct URL
                                let extension = '.jpg'; // default fallback
                                try {
                                    const urlObj = new URL(directImageUrl);
                                    const pathname = urlObj.pathname;
                                    const pathExtension = pathname.split('.').pop();
                                    if (pathExtension && pathExtension.length <= 5) {
                                        const candidateExt = '.' + pathExtension.toLowerCase();
                                        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp'];
                                        if (validExtensions.includes(candidateExt)) {
                                            extension = candidateExt;
                                        }
                                    }
                                } catch (error) {
                                    console.log(`Error extracting extension from URL: ${error.message}, using .jpg`);
                                }

                                const fileName = `${orderNumber}${extension}`;
                                const correctMimeType = this.getMimeTypeFromExtension(extension);
                                console.log(`Final: ${fileName} (${correctMimeType})`);
                                console.log(`=== END PROCESSING PRODUCTION IMAGE ===`);

                                // Upload to Google Drive with correct MIME type
                                const uploadResult = await this.uploadImageToFolder(
                                    batchFolderId,
                                    fileName,
                                    stream,
                                    correctMimeType
                                );

                                batchResults.images.push({
                                    orderNumber: orderNumber,
                                    originalUrl: imageUrl,
                                    directUrl: directImageUrl,
                                    fileName: fileName,
                                    driveFileId: uploadResult.fileId,
                                    webViewLink: uploadResult.webViewLink,
                                    status: 'success'
                                });

                                successCount++;
                            } catch (error) {
                                console.error(`Failed to process image for order ${orderNumber}:`, error.message);
                                
                                batchResults.images.push({
                                    orderNumber: orderNumber,
                                    originalUrl: imageUrl,
                                    directUrl: null, // Set to null since extraction may have failed
                                    fileName: null,
                                    driveFileId: null,
                                    webViewLink: null,
                                    status: 'failed',
                                    error: error.message
                                });

                                failureCount++;
                            }
                        }));

                        // Add delay between batches to prevent memory buildup and rate limiting
                        if (i + batchSize < imageKeys.length) {
                            console.log(`Waiting ${GOOGLE_DRIVE_CONFIG.imageSettings.batchDelay}ms before next batch...`);
                            await new Promise(resolve => setTimeout(resolve, GOOGLE_DRIVE_CONFIG.imageSettings.batchDelay));
                            
                            // Force garbage collection if available (Node.js with --expose-gc flag)
                            if (global.gc) {
                                global.gc();
                                console.log('Performed garbage collection');
                            }
                        }
                    }

                    results.push(batchResults);
                }
            }

            return {
                success: true,
                results: results,
                summary: {
                    totalImages: successCount + failureCount,
                    successfulUploads: successCount,
                    failedUploads: failureCount,
                    locationsProcessed: results.length
                }
            };

        } catch (error) {
            console.error('Error in processPolaroidImages:', error.message);
            return {
                success: false,
                error: error.message,
                results: results,
                summary: {
                    totalImages: successCount + failureCount,
                    successfulUploads: successCount,
                    failedUploads: failureCount,
                    locationsProcessed: results.length
                }
            };
        }
    }

    // Test method for polaroid processing with specific order number
    async testPolaroidProcessing(orderNumber) {
        if (!this.initialized) {
            await this.initialize();
        }

        console.log(`Starting test polaroid processing for order: ${orderNumber}`);

        try {
            // Simple query to get polaroid data for the specific order
            const mysql = require('mysql2/promise');
            const dbConfig = {
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                port: process.env.DB_PORT || 3306
            };

            const connection = await mysql.createConnection(dbConfig);

            try {
                const query = `
                    SELECT
                        so.order_number,
                        so.created_at,
                        sop.properties
                    FROM flowerchimp.shopify_orders so
                    LEFT JOIN shopify_order_products sop ON so.id = sop.order_id
                    LEFT JOIN shopify_products sp ON sp.variant_id = sop.variant_id
                    WHERE so.order_number = ?
                        AND sp.tags LIKE '%product:imageupload%'
                `;

                const [results] = await connection.execute(query, [orderNumber]);

                if (results.length === 0) {
                    return {
                        success: false,
                        error: `No polaroid data found for order number: ${orderNumber}`,
                        orderNumber: orderNumber
                    };
                }

                console.log(`Found ${results.length} polaroid products for order ${orderNumber}`);

                // Log all results to see structure
                console.log('=== RAW RESULTS DEBUG ===');
                results.forEach((row, index) => {
                    console.log(`Row ${index + 1}:`);
                    console.log('  order_number:', row.order_number);
                    console.log('  created_at:', row.created_at);
                    console.log('  properties type:', typeof row.properties);
                    console.log('  properties value:', row.properties);
                    console.log('  properties keys:', row.properties ? Object.keys(row.properties) : 'null/undefined');
                });
                console.log('=== END RAW RESULTS DEBUG ===');

                // Extract image URLs from properties and get order creation date
                const imageUrls = [];
                const orderCreatedAt = results.length > 0 ? results[0].created_at : null;
                console.log(`\n=== ORDER DATE FOR URL PROCESSING ===`);
                console.log(`Order created at: ${orderCreatedAt}`);
                console.log(`=== END ORDER DATE DEBUG ===`);

                results.forEach((row, rowIndex) => {
                    console.log(`\n--- Processing row ${rowIndex + 1} ---`);

                    if (row.properties) {
                        try {
                            // Check if properties is already an object or a string
                            let properties;
                            if (typeof row.properties === 'string') {
                                console.log('Properties is string, parsing JSON...');
                                properties = JSON.parse(row.properties);
                            } else {
                                console.log('Properties is already an object');
                                properties = row.properties;
                            }

                            console.log('Parsed properties type:', typeof properties);
                            console.log('Parsed properties:', properties);

                            // Handle both array and object formats
                            if (Array.isArray(properties)) {
                                console.log('Properties is array format');
                                properties.forEach((prop, propIndex) => {
                                    console.log(`  Property ${propIndex + 1}:`, prop);
                                    if (prop.name && (prop.name.toLowerCase().includes('image') || prop.name.toLowerCase().includes('polaroid')) && prop.value) {
                                        console.log(`    → Found image URL: ${prop.value}`);
                                        imageUrls.push(prop.value);
                                    }
                                });
                            } else if (typeof properties === 'object') {
                                console.log('Properties is object format');
                                Object.keys(properties).forEach(key => {
                                    console.log(`  Key: "${key}" → Value: "${properties[key]}"`);
                                    if (key.toLowerCase().includes('image') && properties[key]) {
                                        console.log(`    → Found image URL: ${properties[key]}`);
                                        imageUrls.push(properties[key]);
                                    }
                                });
                            } else {
                                console.log('Properties is neither array nor object:', typeof properties);
                            }
                        } catch (error) {
                            console.error('Error parsing properties:', error);
                            console.log('Properties type:', typeof row.properties);
                            console.log('Properties value:', row.properties);
                        }
                    } else {
                        console.log('No properties found for this row');
                    }
                });

                console.log(`\n=== FINAL RESULT ===`);
                console.log(`Found ${imageUrls.length} image URLs total:`);
                imageUrls.forEach((url, index) => {
                    console.log(`  ${index + 1}. URL: ${url.substring(0, 100)}...`);
                });

                if (imageUrls.length === 0) {
                    return {
                        success: false,
                        error: `No image URLs found in properties for order: ${orderNumber}`,
                        orderNumber: orderNumber
                    };
                }

                console.log(`Found ${imageUrls.length} image URLs for processing`);

                // Process each image and save directly to main folder
                const processedImages = [];
                let successCount = 0;
                let failureCount = 0;

                for (let i = 0; i < imageUrls.length; i++) {
                    const originalUrl = imageUrls[i];

                    try {
                        console.log(`\n=== PROCESSING IMAGE ${i + 1}/${imageUrls.length} ===`);
                        console.log(`Original URL: ${originalUrl.substring(0, 100)}...`);

                        // Extract direct image URL based on URL type
                        const directImageUrl = await this.extractDirectImageUrl(originalUrl, orderCreatedAt);
                        console.log(`Using URL for download: ${directImageUrl.substring(0, 100)}...`);

                        // Download the image using blob method for test function
                        const { stream, contentType } = await this.downloadImageAsBlob(directImageUrl);

                        // Extract extension and MIME type from direct URL
                        let extension = '.jpg'; // default fallback
                        let correctMimeType = 'image/jpeg';

                        try {
                            const urlObj = new URL(directImageUrl);
                            const pathname = urlObj.pathname;
                            console.log(`URL pathname: ${pathname}`);

                            // Extract extension from the file path
                            const pathExtension = pathname.split('.').pop();
                            if (pathExtension && pathExtension.length <= 5) {
                                extension = '.' + pathExtension.toLowerCase();
                                console.log(`Extracted extension from path: "${extension}"`);

                                // Validate it's a known image extension
                                const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp'];
                                if (!validExtensions.includes(extension)) {
                                    console.log(`Invalid extension "${extension}", falling back to .jpg`);
                                    extension = '.jpg';
                                }
                            }

                            // Set correct MIME type based on extension
                            const mimeMap = {
                                '.jpg': 'image/jpeg',
                                '.jpeg': 'image/jpeg',
                                '.png': 'image/png',
                                '.gif': 'image/gif',
                                '.webp': 'image/webp',
                                '.heic': 'image/heic',
                                '.heif': 'image/heif',
                                '.bmp': 'image/bmp'
                            };
                            correctMimeType = mimeMap[extension] || 'image/jpeg';

                        } catch (error) {
                            console.log(`Error parsing URL for extension: ${error.message}`);
                        }

                        console.log(`Final: Extension: ${extension}, MIME: ${correctMimeType}`);

                        const fileName = `${orderNumber}_${i + 1}${extension}`;

                        console.log(`Uploading as: ${fileName} (${correctMimeType})`);

                        // Upload directly to main folder for testing
                        const uploadResult = await this.uploadImageToFolder(
                            GOOGLE_DRIVE_CONFIG.mainFolderId,
                            fileName,
                            stream,
                            correctMimeType
                        );

                        processedImages.push({
                            imageIndex: i + 1,
                            originalUrl: originalUrl,
                            directUrl: directImageUrl,
                            fileName: fileName,
                            extension: extension,
                            mimeType: correctMimeType,
                            driveFileId: uploadResult.fileId,
                            webViewLink: uploadResult.webViewLink,
                            status: 'success'
                        });

                        successCount++;
                        console.log(`Successfully uploaded: ${fileName}`);

                    } catch (error) {
                        console.error(`Failed to process image ${i + 1}:`, error.message);

                        processedImages.push({
                            imageIndex: i + 1,
                            originalUrl: originalUrl,
                            directUrl: null, // Set to null since it may not be defined if extraction failed
                            fileName: null,
                            extension: null,
                            mimeType: null,
                            driveFileId: null,
                            webViewLink: null,
                            status: 'failed',
                            error: error.message
                        });

                        failureCount++;
                    }

                    // Small delay between uploads
                    if (i < imageUrls.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

                return {
                    success: successCount > 0,
                    orderNumber: orderNumber,
                    summary: {
                        totalImages: imageUrls.length,
                        successfulUploads: successCount,
                        failedUploads: failureCount
                    },
                    processedImages: processedImages
                };

            } finally {
                await connection.end();
            }

        } catch (error) {
            console.error('Error in test polaroid processing:', error.message);
            return {
                success: false,
                error: error.message,
                orderNumber: orderNumber
            };
        }
    }

    /**
     * Upload PDF buffer to Google Drive folder structure
     * Creates folder structure: location/delivery_date/Batch_X
     * @param {Buffer} pdfBuffer - PDF file content as buffer
     * @param {string} filename - Name for the PDF file
     * @param {string} location - Location name (e.g., 'Melbourne')
     * @param {string} deliveryDate - Delivery date (YYYY-MM-DD)
     * @param {number} batch - Batch number
     * @returns {Promise<Object>} Upload result with file details
     */
    async uploadPdfToFolder(pdfBuffer, filename, location, deliveryDate, batch, isSameDay) {
        if (!this.initialized) {
            await this.initialize();
        }

        console.log(`\n☁️  === UPLOADING PDF TO GOOGLE DRIVE ===`);
        console.log(`  Location: ${location}`);
        console.log(`  Delivery Date: ${deliveryDate}`);
        console.log(`  Batch: ${batch}`);
        console.log(`  Filename: ${filename}`);
        console.log(`  Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

        try {
            // Create folder structure: main -> location -> delivery_date -> batch_number
            console.log(`📁 Creating/finding folder structure...`);

            const locationFolderId = await this.findOrCreateFolder(
                GOOGLE_DRIVE_CONFIG.mainFolderId,
                location
            );

            const dateFolderId = await this.findOrCreateFolder(
                locationFolderId,
                deliveryDate
            );

            const deliveryType = isSameDay === '1' ? 'same-day' : 'next-day';
            const batchFolderId = await this.findOrCreateFolder(
                dateFolderId,
                `Batch_${batch}_${deliveryType}`
            );

            const folderPath = `${location}/${deliveryDate}/Batch_${batch}_${deliveryType}`;
            console.log(`✅ Folder structure ready: ${folderPath}`);

            // Upload the PDF file
            console.log(`📤 Uploading PDF file...`);

            const fileMetadata = {
                name: filename,
                mimeType: 'application/pdf',
                parents: [batchFolderId]
            };

            const media = {
                mimeType: 'application/pdf',
                body: require('stream').Readable.from(pdfBuffer)
            };

            const uploadResponse = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, mimeType, size, webViewLink',
                supportsAllDrives: true
            });

            console.log(`✅ PDF uploaded successfully`);
            console.log(`  File ID: ${uploadResponse.data.id}`);
            console.log(`  File Name: ${uploadResponse.data.name}`);
            console.log(`  File Size: ${uploadResponse.data.size} bytes`);
            console.log(`  Web View Link: ${uploadResponse.data.webViewLink || 'N/A'}`);
            console.log(`=== END PDF UPLOAD ===\n`);

            return {
                success: true,
                fileId: uploadResponse.data.id,
                fileName: uploadResponse.data.name,
                fileSize: uploadResponse.data.size,
                webViewLink: uploadResponse.data.webViewLink,
                folderPath: folderPath,
                location: location,
                deliveryDate: deliveryDate,
                batch: batch
            };

        } catch (error) {
            console.error(`❌ Error uploading PDF to Google Drive:`, error.message);
            throw error;
        }
    }
}

module.exports = GoogleDriveService;