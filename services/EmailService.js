const sgMail = require('@sendgrid/mail');
const { EMAIL_CONFIG } = require('../config');

class EmailService {
  constructor() {
    // Initialize SendGrid with API key from config
    if (!EMAIL_CONFIG.sendgridApiKey) {
      console.warn('⚠️ SendGrid API key not configured. Email notifications will be skipped.');
      this.enabled = false;
    } else {
      sgMail.setApiKey(EMAIL_CONFIG.sendgridApiKey);
      this.enabled = true;
      console.log('✅ EmailService initialized with SendGrid');
    }
  }

  /**
   * Send email notification for a single unsuccessful order
   * Routes to correct recipients based on store (LVLY or BL)
   * @param {Object} orderData - Order tracking array entry (must have 'store' field)
   * @returns {Promise<{success: boolean, error?: string, recipients?: Object}>}
   */
  async sendUnsuccessfulOrderEmail(orderData) {
    if (!this.enabled) {
      return { success: false, error: 'EmailService not enabled (API key missing)' };
    }

    try {
      // Get store-specific recipients based on order.store (LVLY or BL)
      const recipients = EMAIL_CONFIG.getRecipients(orderData.store);

      console.log(`📧 Routing email for order ${orderData.order_number} to ${orderData.store} team`);
      console.log(`   TO: ${recipients.to.join(', ')}`);

      // Generate subject from template
      const subject = EMAIL_CONFIG.template.subject(orderData);

      // Generate HTML body from template
      const htmlBody = EMAIL_CONFIG.template.generateBody(orderData);

      // Prepare email message with store-specific recipients
      const msg = {
        to: recipients.to,
        from: {
          email: EMAIL_CONFIG.from.email,
          name: EMAIL_CONFIG.from.name
        },
        subject: subject,
        html: htmlBody
      };

      // Send email via SendGrid
      await sgMail.send(msg);

      console.log(`✅ Email sent successfully for order ${orderData.order_number} (${orderData.store})`);
      return {
        success: true,
        recipients: {
          to: recipients.to,
          store: orderData.store
        }
      };

    } catch (error) {
      console.error(`❌ Failed to send email for order ${orderData.order_number}:`, error.message);

      // Log detailed SendGrid error if available
      if (error.response && error.response.body) {
        console.error('SendGrid error details:', JSON.stringify(error.response.body, null, 2));
      }

      return {
        success: false,
        error: error.message,
        details: error.response?.body
      };
    }
  }

  /**
   * Send emails for multiple unsuccessful orders (store-aware routing)
   * @param {Array} unsuccessfulOrders - Array of order tracking entries
   * @returns {Promise<{totalSent: number, totalFailed: number, byStore: Object, results: Array}>}
   */
  async sendUnsuccessfulOrdersEmails(unsuccessfulOrders) {
    if (!this.enabled) {
      console.warn('⚠️ EmailService disabled, skipping email notifications');
      return { totalSent: 0, totalFailed: 0, byStore: {}, results: [] };
    }

    console.log(`\n📧 === SENDING UNSUCCESSFUL ORDER EMAILS (STORE-BASED ROUTING) ===`);
    console.log(`Total unsuccessful orders: ${unsuccessfulOrders.length}`);

    // Count orders by store
    const storeBreakdown = unsuccessfulOrders.reduce((acc, order) => {
      const store = order.store || 'Unknown';
      acc[store] = (acc[store] || 0) + 1;
      return acc;
    }, {});
    console.log(`Store breakdown:`, storeBreakdown);

    const results = [];
    let successCount = 0;
    let failureCount = 0;
    const byStore = { LVLY: 0, BL: 0, Unknown: 0 };

    // Send one email per order, routed to correct store team
    for (const order of unsuccessfulOrders) {
      const result = await this.sendUnsuccessfulOrderEmail(order);

      results.push({
        order_number: order.order_number,
        order_id: order.id,
        location: order.location,
        store: order.store,
        success: result.success,
        recipients: result.recipients,
        error: result.error || null
      });

      if (result.success) {
        successCount++;
        const store = order.store || 'Unknown';
        byStore[store] = (byStore[store] || 0) + 1;
      } else {
        failureCount++;
      }

      // Small delay to avoid rate limits (though unlikely with 1 email per order)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n✅ Email summary: ${successCount} sent, ${failureCount} failed`);
    console.log(`   By store: LVLY=${byStore.LVLY}, BL=${byStore.BL}, Unknown=${byStore.Unknown}`);
    console.log(`=== END UNSUCCESSFUL ORDER EMAILS ===\n`);

    return {
      totalSent: successCount,
      totalFailed: failureCount,
      byStore: byStore,
      results: results
    };
  }
}

module.exports = EmailService;
