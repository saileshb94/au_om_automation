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
            const searchResponse = await this.drive.files.list({
                q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder'`,
                fields: 'files(id, name)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true
            });

            if (searchResponse.data.files.length > 0) {
                console.log(`Found existing folder: ${folderName}`);
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

    async preCreateFolderStructure(successfulOrders, deliveryDate, batchNumbers) {
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
            // Extract unique locations from successful orders
            const uniqueLocations = [...new Set(
                successfulOrders
                    .filter(order => order.location)
                    .map(order => order.location)
            )];

            results.summary.totalLocations = uniqueLocations.length;
            console.log(`Pre-creating folder structure for ${uniqueLocations.length} locations on ${deliveryDate}`);

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
                    console.log(`Creating folder structure for ${location}, batch ${batchNumber}`);
                    
                    // Create folder structure: main -> location -> delivery_date -> batch_number
                    const locationFolderId = await this.findOrCreateFolder(
                        GOOGLE_DRIVE_CONFIG.mainFolderId, 
                        location
                    );

                    const dateFolderId = await this.findOrCreateFolder(
                        locationFolderId, 
                        deliveryDate
                    );

                    const batchFolderId = await this.findOrCreateFolder(
                        dateFolderId, 
                        `Batch_${batchNumber}`
                    );

                    const folderPath = `${location}/${deliveryDate}/Batch_${batchNumber}`;
                    
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

            return {
                stream: response.data,
                contentType: response.headers['content-type'] || 'image/jpeg',
                contentLength: response.headers['content-length']
            };
        } catch (error) {
            console.error(`Error downloading image from ${url}:`, error.message);
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
            // Extract extension from URL
            const urlPath = new URL(url).pathname;
            const extension = path.extname(urlPath).toLowerCase();
            
            // If no extension found in URL, try to detect from content
            if (!extension) {
                // Default to .jpg if we can't determine
                return '.jpg';
            }
            
            // Validate against supported formats
            if (GOOGLE_DRIVE_CONFIG.imageSettings.supportedFormats.includes(extension)) {
                return extension;
            }
            
            return '.jpg'; // Default fallback
        } catch (error) {
            console.error('Error extracting file extension:', error.message);
            return '.jpg';
        }
    }

    async processPolaroidImages(personalizedData, deliveryDate, batchNumbers) {
        if (!this.initialized) {
            await this.initialize();
        }

        const results = [];
        let successCount = 0;
        let failureCount = 0;

        try {
            for (const locationData of personalizedData) {
                if (!locationData.polaroid_photo_data) continue;

                const location = locationData.location;
                const batchNumber = batchNumbers[location];

                if (batchNumber === undefined || batchNumber === null) {
                    console.log(`No batch number for location: ${location}, skipping polaroid processing`);
                    continue;
                }

                console.log(`Processing polaroid images for ${location}, batch ${batchNumber}`);

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

                const batchFolderId = await this.findOrCreateFolder(
                    dateFolderId, 
                    `Batch_${batchNumber}`
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
                            const orderNumber = batch[orderKey];

                            if (!imageUrl || !orderNumber) return;

                            try {
                                // Download the image (using streaming)
                                const { stream, contentType } = await this.downloadImage(imageUrl);
                                
                                // Generate filename: orderNumber + extension
                                const extension = this.getFileExtensionFromUrl(imageUrl);
                                const fileName = `${orderNumber}${extension}`;

                                // Upload to Google Drive
                                const uploadResult = await this.uploadImageToFolder(
                                    batchFolderId,
                                    fileName,
                                    stream,
                                    contentType
                                );

                                batchResults.images.push({
                                    orderNumber: orderNumber,
                                    originalUrl: imageUrl,
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
}

module.exports = GoogleDriveService;