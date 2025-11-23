const crypto = require('crypto');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');

const chapaWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['chapa-signature'];
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET || 'your-webhook-secret')
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.log('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, data } = req.body;

    if (event === 'charge.success') {
      const { tx_ref, amount, currency, status, customer } = data;
      
      console.log('Payment webhook received:', { tx_ref, amount, status });

      // Find pending ticket purchase by reference
      const tickets = await Ticket.find({ 
        paymentReference: tx_ref,
        status: 'pending'
      }).populate('event user');

      if (tickets.length === 0) {
        console.log('No pending tickets found for reference:', tx_ref);
        return res.status(404).json({ error: 'No pending tickets found' });
      }

      // Verify payment amount matches ticket total
      const totalAmount = tickets.reduce((sum, ticket) => sum + ticket.price, 0);
      if (Math.abs(totalAmount - amount) > 0.01) {
        console.log('Amount mismatch:', { expected: totalAmount, received: amount });
        return res.status(400).json({ error: 'Amount mismatch' });
      }

      // Update tickets to active status
      await Ticket.updateMany(
        { paymentReference: tx_ref },
        { 
          status: 'active',
          paymentStatus: 'completed',
          paymentDate: new Date()
        }
      );

      console.log(`Updated ${tickets.length} tickets to active status`);

      // Send notification (optional)
      // You can add email/SMS notification here

      res.status(200).json({ message: 'Webhook processed successfully' });
    } else {
      console.log('Unhandled webhook event:', event);
      res.status(200).json({ message: 'Event not handled' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  chapaWebhook
};