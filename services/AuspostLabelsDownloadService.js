const axios = require('axios');
const GoogleDriveService = require('../gdrive-service');

/**
 * AuspostLabelsDownloadService
 * Handles downloading AusPost label PDFs and uploading them to Google Drive
 */
class AuspostLabelsDownloadService {
  constructor() {
    this.googleDriveService = new GoogleDriveService();
  }

  /**
   * Process label URLs from AusPost Labels API
   * Downloads PDFs and uploads to Google Drive organized by location/date/batch
   * @param {Object} labelsByLocation - Label data grouped by location
   * @returns {Promise<Object>} Processing results
   */
  async processLabels(labelsByLocation) {
    console.log(`\n📥 === AUSPOST LABELS DOWNLOAD SERVICE ===`);

    const results = {
      success: true,
      processedLocations: [],
      errors: [],
      summary: {
        totalLocations: 0,
        successfulUploads: 0,
        failedUploads: 0
      }
    };

    try {
      // Initialize Google Drive service
      await this.googleDriveService.initialize();

      if (!labelsByLocation || Object.keys(labelsByLocation).length === 0) {
        console.log('ℹ️  No label URLs to process');
        return results;
      }

      const locations = Object.keys(labelsByLocation);
      results.summary.totalLocations = locations.length;
      console.log(`📊 Processing ${locations.length} locations`);

      for (const location of locations) {
        const labelData = labelsByLocation[location];
        console.log(`\n📍 === Processing ${location} ===`);
        console.log(`  Delivery Date: ${labelData.delivery_date}`);
        console.log(`  Batch: ${labelData.batch}`);
        console.log(`  Items Count: ${labelData.items_count}`);
        console.log(`  Label URL: ${labelData.label_url}`);

        try {
          // Download and upload the PDF
          const uploadResult = await this.downloadAndUploadLabel(
            labelData.label_url,
            location,
            labelData.delivery_date,
            labelData.batch,
            labelData.isSameDay
          );

          results.processedLocations.push({
            location: location,
            success: true,
            uploadResult: uploadResult,
            labelData: labelData
          });

          results.summary.successfulUploads++;
          console.log(`✅ ${location}: Label uploaded successfully`);

        } catch (error) {
          console.error(`❌ ${location}: Failed to process label - ${error.message}`);

          results.processedLocations.push({
            location: location,
            success: false,
            error: error.message,
            labelData: labelData
          });

          results.errors.push(`${location}: ${error.message}`);
          results.summary.failedUploads++;
        }

        // Small delay between uploads
        if (results.summary.totalLocations > 1) {
          console.log(`⏳ Waiting 500ms before next upload...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`\n📊 === AUSPOST LABELS DOWNLOAD SUMMARY ===`);
      console.log(`Total locations: ${results.summary.totalLocations}`);
      console.log(`Successful uploads: ${results.summary.successfulUploads}`);
      console.log(`Failed uploads: ${results.summary.failedUploads}`);

      if (results.summary.failedUploads > 0) {
        results.success = false;
      }

      console.log(`=== END AUSPOST LABELS DOWNLOAD ===\n`);

      return results;

    } catch (error) {
      console.error('💥 AuspostLabelsDownloadService error:', error.message);
      return {
        success: false,
        processedLocations: [],
        errors: [`Service error: ${error.message}`],
        summary: {
          totalLocations: 0,
          successfulUploads: 0,
          failedUploads: 0
        }
      };
    }
  }

  /**
   * Download PDF from URL and upload to Google Drive
   * @param {string} labelUrl - URL to download PDF from
   * @param {string} location - Location name (e.g., 'Melbourne')
   * @param {string} deliveryDate - Delivery date (YYYY-MM-DD)
   * @param {number} batch - Batch number
   * @param {string} isSameDay - Delivery type ('same-day' or 'next-day')
   * @returns {Promise<Object>} Upload result with file details
   */
  async downloadAndUploadLabel(labelUrl, location, deliveryDate, batch, isSameDay) {
    console.log(`\n📥 Downloading label PDF from URL...`);
    console.log(`  URL: ${labelUrl}`);

    try {
      // Download PDF from URL
      const response = await axios.get(labelUrl, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 seconds
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download PDF - HTTP ${response.status}`);
      }

      const pdfBuffer = Buffer.from(response.data);
      console.log(`✅ PDF downloaded - Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

      // Generate filename
      const filename = `auspost_labels_${location}_batch_${batch}.pdf`;
      console.log(`📄 Filename: ${filename}`);

      // Upload to Google Drive
      console.log(`☁️  Uploading to Google Drive...`);
      const uploadResult = await this.googleDriveService.uploadPdfToFolder(
        pdfBuffer,
        filename,
        location,
        deliveryDate,
        batch,
        isSameDay
      );

      console.log(`✅ Upload successful - File ID: ${uploadResult.fileId}`);

      return {
        success: true,
        filename: filename,
        fileId: uploadResult.fileId,
        folderPath: uploadResult.folderPath,
        fileSize: pdfBuffer.length
      };

    } catch (error) {
      console.error(`❌ Error downloading/uploading label:`, error.message);
      throw error;
    }
  }
}

module.exports = AuspostLabelsDownloadService;
