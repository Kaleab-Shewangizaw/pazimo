
// payment service

// const axios = require('axios');
// const { StatusCodes } = require('http-status-codes');
// const CustomError = require('../errors/customError');
// const Event = require('../models/Event');
// const Ticket = require('../models/Ticket');

// class PaymentService {
//     constructor() {
//         this.baseURL = 'https://api.chapa.co/v1';
//         this.secretKey = process.env.CHAPA_SECRET_KEY;
        
//         // // Debug logging
//         // // console.log('Chapa API Key Status:', {
//         //     exists: !!this.secretKey,
//         //     length: this.secretKey ? this.secretKey.length : 0,
//         //     prefix: this.secretKey ? this.secretKey.substring(0, 8) : 'none',
//         //     env: process.env.NODE_ENV
//         // });
        
//         if (!this.secretKey) {
//             throw new Error('CHAPA_SECRET_KEY is not configured in environment variables');
//         }

//         if (!this.secretKey.startsWith('CHASECK-')) {
//         // if (!this.secretKey.startsWith('CHASECK_TEST-')) {

//             throw new Error('Invalid CHAPA_SECRET_KEY format. Should start with CHASECK_TEST-');
//             // throw new Error('Invalid CHAPA_SECRET_KEY format. Should start with CHASECK-');
//         }

//         this.client = axios.create({
//             baseURL: this.baseURL,
//             headers: {
//                 'Authorization': `Bearer ${this.secretKey}`,
//                 'Content-Type': 'application/json'
//             }
//         });

//         // Add response interceptor for debugging
//         this.client.interceptors.response.use(
//             response => response,
//             error => {
//                 if (error.response) {
//                     console.error('Chapa API Error:', {
//                         status: error.response.status,
//                         data: error.response.data,
//                         headers: error.response.headers
//                     });
//                 }
//                 return Promise.reject(error);
//             }
//         );
//     }

//     async initializeTransaction(paymentData) {
//         try {
//             console.log('Payment initialization request received:', JSON.stringify(paymentData, null, 2));
            
//             const {
//                 amount,
//                 currency = 'ETB',
//                 email,
//                 first_name,
//                 last_name,
//                 phone_number,
//                 tx_ref,
//                 callback_url,
//                 return_url,
//                 customization = {},
//                 meta = {}
//             } = paymentData;

//             /*
//             console.log('Payment initialization request:', {
//                 amount,
//                 currency,
//                 email,
//                 tx_ref,
//                 callback_url,
//                 return_url,
//                 customization,
//                 meta
//             });
//             */

//             if (!amount || !email || !first_name || !last_name || !tx_ref) {
//                 const missingFields = [];
//                 if (!amount) missingFields.push('amount');
//                 if (!email) missingFields.push('email');
//                 if (!first_name) missingFields.push('first_name');
//                 if (!last_name) missingFields.push('last_name');
//                 if (!tx_ref) missingFields.push('tx_ref');
                
//                 throw new CustomError(
//                     `Missing required payment fields: ${missingFields.join(', ')}`,
//                     StatusCodes.BAD_REQUEST
//                 );
//             }

//             if (!callback_url || !return_url) {
//                 throw new CustomError(
//                     'Missing required URLs (callback_url and return_url)',
//                     StatusCodes.BAD_REQUEST
//                 );
//             }

//             try {
//                 new URL(callback_url);
//                 new URL(return_url);
//             } catch (e) {
//                 throw new CustomError(
//                     'Invalid URL format for callback_url or return_url',
//                     StatusCodes.BAD_REQUEST
//                 );
//             }

//             if (phone_number && !/^(09|07)\d{8}$/.test(phone_number)) {
//                 throw new CustomError(
//                     'Invalid phone number format. Must be 10 digits starting with 09 or 07',
//                     StatusCodes.BAD_REQUEST
//                 );
//             }

//             // Sanitize customization data to meet Chapa requirements
//             const sanitizedCustomization = {};
//             if (customization && typeof customization === 'object') {
//                 Object.keys(customization).forEach(key => {
//                     if (customization[key]) {
//                         // Only allow letters, numbers, hyphens, underscores, spaces, and dots
//                         sanitizedCustomization[key] = String(customization[key])
//                             .replace(/[^a-zA-Z0-9\-_\s\.]/g, '')
//                             .trim();
//                     }
//                 });
//             }

//             const payload = {
//                 amount,
//                 currency,
//                 email,
//                 first_name,
//                 last_name,
//                 tx_ref,
//                 callback_url,
//                 return_url,
//                 customization: sanitizedCustomization,
//                 meta
//             };

//             if (phone_number) {
//                 payload.phone_number = phone_number;
//             }

//             console.log('Sending payload to Chapa:', JSON.stringify(payload, null, 2));
//             const response = await this.client.post('/transaction/initialize', payload);
//             console.log('Chapa response:', JSON.stringify(response.data, null, 2));
//             return response.data;

//         } catch (error) {
//             if (error.response) {
//                 let errorMessage = 'Payment initialization failed';
                
//                 // Handle different error message formats
//                 if (error.response.data?.message) {
//                     if (typeof error.response.data.message === 'string') {
//                         errorMessage = error.response.data.message;
//                     } else if (typeof error.response.data.message === 'object') {
//                         // If message is an object, try to extract meaningful info
//                         errorMessage = JSON.stringify(error.response.data.message);
                        
//                         // Try to extract specific validation errors
//                         if (error.response.data.message.errors) {
//                             const errors = Object.values(error.response.data.message.errors);
//                             errorMessage = errors.join(', ');
//                         } else if (error.response.data.message.error) {
//                             errorMessage = error.response.data.message.error;
//                         }
//                     }
//                 } else if (error.response.data?.error) {
//                     errorMessage = error.response.data.error;
//                 }
                
//                 console.error('Chapa API Error Details:', {
//                     status: error.response.status,
//                     message: errorMessage,
//                     rawMessage: error.response.data?.message,
//                     data: error.response.data,
//                     fullError: JSON.stringify(error.response.data, null, 2)
//                 });
                
//                 throw new CustomError(
//                     errorMessage,
//                     error.response.status || StatusCodes.INTERNAL_SERVER_ERROR
//                 );
//             }
            
//             // If it's already a CustomError, re-throw it
//             if (error.isOperational) {
//                 throw error;
//             }
            
//             console.error('Payment initialization error:', error);
//             throw new CustomError(
//                 error.message || 'Payment initialization failed',
//                 StatusCodes.INTERNAL_SERVER_ERROR
//             );
//         }
//     }

//     verifyCallback(callbackData) {
//         const { trx_ref, ref_id, status } = callbackData;

//         if (!trx_ref || !status) {
//             throw new CustomError(
//                 'Invalid callback data: missing transaction reference or status',
//                 StatusCodes.BAD_REQUEST
//             );
//         }

//         if (status.toLowerCase() === 'success') {
//             return {
//                 transactionReference: trx_ref,
//                 referenceId: ref_id || trx_ref,
//                 status: status.toLowerCase(),
//                 isSuccessful: true
//             };
//         }

//         if (!ref_id) {
//             throw new CustomError(
//                 'Invalid callback data: reference ID required for non-success status',
//                 StatusCodes.BAD_REQUEST
//             );
//         }

//         return {
//             transactionReference: trx_ref,
//             referenceId: ref_id,
//             status: status.toLowerCase(),
//             isSuccessful: status.toLowerCase() === 'success'
//         };
//     }

//     async verifyTransaction(tx_ref) {
//         try {
//             console.log('Verifying transaction:', tx_ref);
//             const response = await this.client.get(`/transaction/verify/${tx_ref}`);
//             return response.data;
//         } catch (error) {
//             console.error('Transaction verification error:', error.response?.data || error.message);
//             throw new CustomError(
//                 'Failed to verify transaction',
//                 error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR
//             );
//         }
//     }

//     async getStoredPaymentInfo(tx_ref) {
//         try {
//             const transaction = await this.verifyTransaction(tx_ref);
//             const meta = transaction.data?.meta || {};
            
//             if (meta.quantity) {
//                 meta.quantity = parseInt(meta.quantity, 10);
//             }
            
//             return meta;
//         } catch (error) {
//             console.error('Error getting stored payment info:', error);
//             return null;
//         }
//     }

//     async completeTicketPurchase(purchaseData) {
//         const {
//             eventId,
//             ticketType,
//             quantity,
//             userId,
//             transactionReference,
//             referenceId
//         } = purchaseData;

//         try {
//             console.log('Purchase data:', purchaseData);
            
//             const event = await Event.findById(eventId);
//             if (!event) {
//                 throw new CustomError('Event not found', StatusCodes.NOT_FOUND);
//             }

//             console.log('Event ticket types:', event.ticketTypes.map(tt => ({ 
//                 _id: tt._id, 
//                 name: tt.name, 
//                 quantity: tt.quantity,
//                 available: tt.available,
//                 endDate: tt.endDate
//             })));
//             console.log('Looking for ticket type:', ticketType);
//             console.log('Requested quantity:', quantity);

//             let ticketTypeDoc;
//             if (ticketType && ticketType._id) {
//                 ticketTypeDoc = event.ticketTypes.id(ticketType._id);
//             } else if (ticketType && (ticketType.name || typeof ticketType === 'string')) {
//                 const typeName = ticketType.name || ticketType;
//                 ticketTypeDoc = event.ticketTypes.find(tt => tt.name === typeName);
//             } else if (typeof ticketType === 'string') {
//                 // Try to find by ID if it's a string that looks like an ObjectId
//                 ticketTypeDoc = event.ticketTypes.id(ticketType) || event.ticketTypes.find(tt => tt.name === ticketType);
//             } else if (!ticketType && event.ticketTypes.length > 0) {
//                 // Fallback: use the first available ticket type if none specified
//                 console.log('No ticket type specified, using first available ticket type');
//                 ticketTypeDoc = event.ticketTypes.find(tt => tt.quantity > 0) || event.ticketTypes[0];
//             } else {
//                 console.error('Invalid ticket type data:', { ticketType, type: typeof ticketType });
//                 throw new CustomError('Invalid ticket type data', StatusCodes.BAD_REQUEST);
//             }
            
//             if (!ticketTypeDoc) {
//                 throw new CustomError('Ticket type not found', StatusCodes.NOT_FOUND);
//             }

//             // Check if ticket type is available (considering time-based availability)
//             const now = new Date();
//             let isTicketAvailable = true;
            
//             // Check if ticket has an end date and if it has passed
//             if (ticketTypeDoc.endDate) {
//                 const ticketEndDate = new Date(ticketTypeDoc.endDate);
//                 if (ticketEndDate.getTime() <= now.getTime()) {
//                     isTicketAvailable = false;
//                 }
//             }
            
//             // Check if ticket is explicitly marked as unavailable
//             if (ticketTypeDoc.available === false) {
//                 isTicketAvailable = false;
//             }
            
//             if (!isTicketAvailable) {
//                 throw new CustomError('This ticket type is no longer available', StatusCodes.BAD_REQUEST);
//             }

//             if (ticketTypeDoc.quantity < quantity) {
//                 console.log('Ticket availability check failed:', {
//                     requested: quantity,
//                     available: ticketTypeDoc.quantity,
//                     ticketType: ticketTypeDoc.name
//                 });
//                 throw new CustomError(`Not enough tickets available. Only ${ticketTypeDoc.quantity} tickets remaining`, StatusCodes.BAD_REQUEST);
//             }

//             const tickets = [];
//             for (let i = 0; i < quantity; i++) {
//                 const ticket = new Ticket({
//                     event: eventId,
//                     ticketType: ticketTypeDoc.name,
//                     user: userId,
//                     price: ticketTypeDoc.price,
//                     status: 'active',
//                     purchaseDate: new Date(),
//                     paymentReference: transactionReference
//                 });
//                 await ticket.save();
//                 console.log('Ticket created with QR:', { ticketId: ticket.ticketId, hasQR: !!ticket.qrCode });
//                 tickets.push(ticket);
//             }

//             ticketTypeDoc.quantity -= quantity;
//             await event.save();

//             return {
//                 success: true,
//                 tickets: tickets.map(ticket => ({
//                     _id: ticket._id,
//                     ticketId: ticket.ticketId,
//                     ticketType: ticket.ticketType,
//                     price: ticket.price,
//                     status: ticket.status,
//                     purchaseDate: ticket.purchaseDate,
//                     qrCode: ticket.qrCode,
//                     paymentReference: ticket.paymentReference
//                 }))
//             };

//         } catch (error) {
//             console.error('Error completing ticket purchase:', error);
//             throw new CustomError(
//                 error.message || 'Failed to complete ticket purchase',
//                 error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR
//             );
//         }
//     }
// }

// module.exports = new PaymentService();












// payment controller


// const { StatusCodes } = require('http-status-codes');
// const paymentService = require('../services/paymentService');
// const { v4: uuidv4 } = require('uuid');
// const Event = require('../models/Event');
// const Ticket = require('../models/Ticket');
// const CustomError = require('../errors/customError');

// class PaymentController {
   
//     async initializePayment(req, res) {
//         try {
//             const paymentData = {
//                 ...req.body,
//                 tx_ref: req.body.tx_ref || `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
//             };

//             const result = await paymentService.initializeTransaction(paymentData);
//             res.status(StatusCodes.OK).json(result);
//         } catch (error) {
//             console.error('Payment initialization error:', error);
//             res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
//                 success: false,
//                 error: error.message
//             });
//         }
//     }

  
//     async handleCallback(req, res) {
//         try {
//             const { trx_ref, ref_id, status } = req.query;

//             console.log('Payment callback received:', { trx_ref, ref_id, status });

//             // Verify the callback data
//             const verificationResult = await paymentService.verifyCallback({
//                 trx_ref,
//                 ref_id,
//                 status
//             });

//             // Verify the transaction with Chapa
//             const transactionDetails = await paymentService.verifyTransaction(trx_ref);

//             console.log('Transaction verification result:', transactionDetails);

//             if (transactionDetails.status !== 'success') {
//                 throw new CustomError(
//                     'Transaction verification failed',
//                     StatusCodes.BAD_REQUEST
//                 );
//             }

//             // Get stored payment info
//             const paymentInfo = await paymentService.getStoredPaymentInfo(trx_ref);
//             console.log('Retrieved payment info:', paymentInfo);
            
//             if (!paymentInfo) {
//                 throw new CustomError(
//                     'Payment information not found',
//                     StatusCodes.NOT_FOUND
//                 );
//             }

//             // Extract ticket type from various possible sources
//             let ticketType = paymentInfo.ticketTypeId || paymentInfo.ticketType || paymentInfo.ticketTypeName;
            
//             // If still no ticket type, try to extract from transaction details
//             if (!ticketType && transactionDetails.data?.customization?.description) {
//                 // Parse "1 x Regular" format
//                 const match = transactionDetails.data.customization.description.match(/\d+\s*x\s*(.+)/);
//                 if (match) {
//                     ticketType = match[1].trim();
//                 }
//             }
            
//             // Complete the ticket purchase
//             const purchaseData = {
//                 eventId: paymentInfo.eventId,
//                 ticketType: ticketType,
//                 quantity: paymentInfo.quantity,
//                 userId: paymentInfo.userId,
//                 transactionReference: trx_ref,
//                 referenceId: ref_id
//             };
            
//             console.log('Prepared purchase data:', purchaseData);
//             const ticketResult = await paymentService.completeTicketPurchase(purchaseData);
            
//             // Redirect to success page with parameters
//             const successUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?id=${paymentInfo.eventId}&quantity=${paymentInfo.quantity}&ticketType=${encodeURIComponent(ticketType || 'Regular')}&tx_ref=${trx_ref}`;
//             res.redirect(successUrl);
//             return;

//             // Send success response
//             res.status(StatusCodes.OK).json({
//                 success: true,
//                 message: 'Payment processed successfully',
//                 data: {
//                     transactionReference: trx_ref,
//                     referenceId: ref_id,
//                     status,
//                     tickets: ticketResult.tickets
//                 }
//             });

//         } catch (error) {
//             console.error('Payment callback error:', error);
//             res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
//                 success: false,
//                 error: error.message
//             });
//         }
//     }

//     /**
//      * Verify a transaction status
//      */
//     async verifyTransaction(req, res) {
//         try {
//             const { tx_ref } = req.params;
//             const result = await paymentService.verifyTransaction(tx_ref);
//             res.status(StatusCodes.OK).json(result);
//         } catch (error) {
//             console.error('Transaction verification error:', error);
//             res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
//                 success: false,
//                 error: error.message
//             });
//         }
//     }
// }

// module.exports = new PaymentController(); 