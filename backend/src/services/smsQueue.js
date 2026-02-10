/**
 * SMS Queue Service - Background SMS Processing
 * 
 * This service provides a queue-based system for sending SMS messages
 * with automatic retries and failure tracking.
 * 
 * Benefits:
 * - Non-blocking SMS sending
 * - Automatic retries for failed messages
 * - Failure tracking and admin dashboard support
 * - Rate limiting to avoid API throttling
 * 
 * Usage:
 * const { smsQueue } = require('./services/smsQueue');
 * await smsQueue.enqueue(phoneNumber, message, { priority: 'high' });
 */

const { sendSMS } = require('../utils/sms');

class SMSQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.failedMessages = [];
    this.stats = {
      sent: 0,
      failed: 0,
      pending: 0,
    };
  }

  /**
   * Add an SMS to the queue
   * @param {string} phone - Phone number
   * @param {string} message - SMS message
   * @param {object} options - Options (priority, maxRetries, etc.)
   */
  async enqueue(phone, message, options = {}) {
    const sms = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      phone,
      message,
      priority: options.priority || 'normal', // 'high', 'normal', 'low'
      maxRetries: options.maxRetries || 3,
      attempts: 0,
      status: 'pending',
      createdAt: new Date(),
      metadata: options.metadata || {}, // e.g., { ticketId, eventId, userId }
    };

    // Add to queue based on priority
    if (sms.priority === 'high') {
      this.queue.unshift(sms); // Add to front
    } else {
      this.queue.push(sms); // Add to back
    }

    this.stats.pending = this.queue.length;

    console.log(`[SMS-Queue] ➕ Enqueued: ${sms.id} (${sms.phone})`);

    // Start processing if not already processing
    if (!this.processing) {
      this.process();
    }

    return sms.id;
  }

  /**
   * Process the SMS queue
   */
  async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    console.log(`[SMS-Queue] 🔄 Processing queue (${this.queue.length} messages)...`);

    while (this.queue.length > 0) {
      const sms = this.queue.shift();
      this.stats.pending = this.queue.length;

      try {
        console.log(`[SMS-Queue] 📤 Sending: ${sms.id} (attempt ${sms.attempts + 1}/${sms.maxRetries})`);
        
        sms.attempts++;
        sms.lastAttemptAt = new Date();

        const result = await sendSMS(sms.phone, sms.message);

        if (result.success) {
          sms.status = 'sent';
          sms.sentAt = new Date();
          this.stats.sent++;
          console.log(`[SMS-Queue] ✅ Sent: ${sms.id} (${result.duration}ms)`);
        } else {
          throw new Error(result.error || 'SMS send failed');
        }
      } catch (error) {
        console.error(`[SMS-Queue] ❌ Failed: ${sms.id} - ${error.message}`);

        if (sms.attempts < sms.maxRetries) {
          // Re-queue for retry
          console.log(`[SMS-Queue] 🔄 Re-queueing: ${sms.id} (attempt ${sms.attempts}/${sms.maxRetries})`);
          this.queue.push(sms); // Add to end of queue
          this.stats.pending = this.queue.length;
        } else {
          // Max retries reached
          sms.status = 'failed';
          sms.failedAt = new Date();
          sms.error = error.message;
          this.failedMessages.push(sms);
          this.stats.failed++;
          console.error(`[SMS-Queue] 💀 Permanently failed: ${sms.id}`);
        }
      }

      // Rate limiting: wait 200ms between messages to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    this.processing = false;
    console.log(`[SMS-Queue] ✅ Queue processing complete`);
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      pending: this.queue.length,
      failedCount: this.failedMessages.length,
    };
  }

  /**
   * Get failed messages
   */
  getFailedMessages(limit = 50) {
    return this.failedMessages.slice(-limit);
  }

  /**
   * Retry a failed message
   */
  async retry(messageId) {
    const msgIndex = this.failedMessages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) {
      throw new Error('Message not found in failed queue');
    }

    const msg = this.failedMessages.splice(msgIndex, 1)[0];
    msg.status = 'pending';
    msg.attempts = 0;
    delete msg.error;

    return this.enqueue(msg.phone, msg.message, {
      priority: 'high',
      maxRetries: msg.maxRetries,
      metadata: msg.metadata,
    });
  }

  /**
   * Retry all failed messages
   */
  async retryAll() {
    const failedCount = this.failedMessages.length;
    console.log(`[SMS-Queue] 🔄 Retrying ${failedCount} failed messages...`);

    const promises = this.failedMessages.map(msg => this.retry(msg.id));
    await Promise.all(promises);

    console.log(`[SMS-Queue] ✅ Re-queued ${failedCount} messages`);
    return failedCount;
  }

  /**
   * Clear failed messages older than X days
   */
  clearOldFailedMessages(daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const initialCount = this.failedMessages.length;
    this.failedMessages = this.failedMessages.filter(
      msg => new Date(msg.failedAt) > cutoffDate
    );

    const removedCount = initialCount - this.failedMessages.length;
    console.log(`[SMS-Queue] 🗑️  Cleared ${removedCount} old failed messages`);
    return removedCount;
  }
}

// Export singleton instance
const smsQueue = new SMSQueue();

module.exports = { smsQueue, SMSQueue };
