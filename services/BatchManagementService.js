const { Firestore } = require('@google-cloud/firestore');

class BatchManagementService {
  constructor() {
    this.firestore = new Firestore();
    this.BATCH_COLLECTION = 'batch_counters';
    this.LOCATIONS = ['Melbourne', 'Sydney', 'Perth', 'Adelaide', 'Brisbane'];
  }

  async getBatchNumbers(deliveryDate, isSameDay) {
    const deliveryType = isSameDay === '1' ? 'same-day' : 'next-day';
    console.log(`Fetching batch numbers for date: ${deliveryDate}, delivery type: ${deliveryType}`);
    const batchNumbers = {};

    for (const location of this.LOCATIONS) {
      const key = `${location}_${deliveryDate}_${deliveryType}`;
      try {
        const docRef = this.firestore.collection(this.BATCH_COLLECTION).doc(key);
        const doc = await docRef.get();

        if (doc.exists) {
          batchNumbers[location] = doc.data().batch || 0;
        } else {
          // Create new entry with batch 0
          batchNumbers[location] = 0;
          await docRef.set({ batch: 0, created_at: new Date(), updated_at: new Date() });
        }
      } catch (error) {
        console.error(`Firestore: Error fetching batch for ${location}:`, error.message);
        batchNumbers[location] = null; // Will be handled in batch update logic
      }
    }

    console.log('Firestore: Current batch numbers:', batchNumbers);
    return batchNumbers;
  }

  async updateBatchNumbers(deliveryDate, locationOrderCounts, currentBatchNumbers, isSameDay) {
    const deliveryType = isSameDay === '1' ? 'same-day' : 'next-day';
    console.log(`Firestore: Updating batch numbers based on order counts (${deliveryType}):`, locationOrderCounts);
    const updatedBatchNumbers = { ...currentBatchNumbers };

    for (const location of this.LOCATIONS) {
      const orderCount = locationOrderCounts[location] || 0;
      const currentBatch = currentBatchNumbers[location];

      if (currentBatch === null) {
        console.log(`Firestore: Skipping update for ${location} due to previous error`);
        continue;
      }

      if (orderCount > 0) {
        // Increment batch number
        const newBatch = currentBatch + 1;
        updatedBatchNumbers[location] = newBatch;
        const key = `${location}_${deliveryDate}_${deliveryType}`;
        try {
          const docRef = this.firestore.collection(this.BATCH_COLLECTION).doc(key);
          await docRef.update({
            batch: newBatch,
            updated_at: new Date(),
            last_order_count: orderCount
          });
          console.log(`Firestore: Updated batch for ${location} (${deliveryType}): ${currentBatch} -> ${newBatch} (${orderCount} orders)`);
        } catch (error) {
          console.error(`Firestore: Error updating batch for ${location}:`, error.message);
          updatedBatchNumbers[location] = null;
        }
      } else {
        console.log(`Firestore: No orders for ${location}, keeping batch at ${currentBatch}`);
      }
    }

    console.log('Firestore: Final batch numbers:', updatedBatchNumbers);
    return updatedBatchNumbers;
  }
}

module.exports = BatchManagementService;