



const axios = require('axios');
const { StatusCodes } = require('http-status-codes');
const CustomError = require('../errors/customError');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');

class PaymentService {
    constructor() {
        this.baseURL = 'https://api.chapa.co/v1';
        this.secretKey = process.env.CHAPA_SECRET_KEY;

        if (!this.secretKey) {
            throw new Error('CHAPA_SECRET_KEY is not configured in environment variables');
        }

        if (!this.secretKey.startsWith('CHASECK-')) {
            throw new Error('Invalid CHAPA_SECRET_KEY format. Should start with CHASECK_TEST-');
        }

        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json'
            }
        });

        this.client.interceptors.response.use(
            response => response,
            error => {
                if (error.response) {
                    console.error('Chapa API Error:', {
                        status: error.response.status,
                        data: error.response.data
                    });
                }
                return Promise.reject(error);
            }
        );
    }

    async initializeTransaction(paymentData) {
        try {
            const {
                amount,
                currency = 'ETB',
                email,
                first_name,
                last_name,
                phone_number,
                tx_ref,
                callback_url,
                return_url,
                customization = {},
                meta = {}
            } = paymentData;

            if (!amount || !email || !first_name || !last_name || !tx_ref) {
                const missingFields = [];
                if (!amount) missingFields.push('amount');
                if (!email) missingFields.push('email');
                if (!first_name) missingFields.push('first_name');
                if (!last_name) missingFields.push('last_name');
                if (!tx_ref) missingFields.push('tx_ref');

                throw new CustomError(
                    `Missing required payment fields: ${missingFields.join(', ')}`,
                    StatusCodes.BAD_REQUEST
                );
            }

            if (!callback_url || !return_url) {
                throw new CustomError(
                    'Missing required URLs (callback_url and return_url)',
                    StatusCodes.BAD_REQUEST
                );
            }

            try {
                new URL(callback_url);
                new URL(return_url);
            } catch {
                throw new CustomError(
                    'Invalid URL format for callback_url or return_url',
                    StatusCodes.BAD_REQUEST
                );
            }

            if (phone_number && !/^(09|07)\d{8}$/.test(phone_number)) {
                throw new CustomError(
                    'Invalid phone number format. Must be 10 digits starting with 09 or 07',
                    StatusCodes.BAD_REQUEST
                );
            }

            const sanitizedCustomization = {};
            if (customization && typeof customization === 'object') {
                Object.keys(customization).forEach(key => {
                    if (customization[key]) {
                        sanitizedCustomization[key] = String(customization[key])
                            .replace(/[^a-zA-Z0-9\-_\s\.]/g, '')
                            .trim();
                    }
                });
            }

            const payload = {
                amount,
                currency,
                email,
                first_name,
                last_name,
                tx_ref,
                callback_url,
                return_url,
                customization: sanitizedCustomization,
                meta
            };

            if (phone_number) payload.phone_number = phone_number;

            const response = await this.client.post('/transaction/initialize', payload);
            return response.data;

        } catch (error) {
            if (error.response) {
                let errorMessage = 'Payment initialization failed';
                if (error.response.data?.message) {
                    if (typeof error.response.data.message === 'string') {
                        errorMessage = error.response.data.message;
                    } else if (typeof error.response.data.message === 'object') {
                        errorMessage = JSON.stringify(error.response.data.message);
                        if (error.response.data.message.errors) {
                            const errors = Object.values(error.response.data.message.errors);
                            errorMessage = errors.join(', ');
                        } else if (error.response.data.message.error) {
                            errorMessage = error.response.data.message.error;
                        }
                    }
                } else if (error.response.data?.error) {
                    errorMessage = error.response.data.error;
                }

                throw new CustomError(
                    errorMessage,
                    error.response.status || StatusCodes.INTERNAL_SERVER_ERROR
                );
            }

            if (error.isOperational) throw error;

            throw new CustomError(
                error.message || 'Payment initialization failed',
                StatusCodes.INTERNAL_SERVER_ERROR
            );
        }
    }

    verifyCallback({ trx_ref, ref_id, status }) {
        if (!trx_ref || !status) {
            throw new CustomError(
                'Invalid callback data: missing transaction reference or status',
                StatusCodes.BAD_REQUEST
            );
        }

        if (status.toLowerCase() === 'success') {
            return {
                transactionReference: trx_ref,
                referenceId: ref_id || trx_ref,
                status: status.toLowerCase(),
                isSuccessful: true
            };
        }

        if (!ref_id) {
            throw new CustomError(
                'Invalid callback data: reference ID required for non-success status',
                StatusCodes.BAD_REQUEST
            );
        }

        return {
            transactionReference: trx_ref,
            referenceId: ref_id,
            status: status.toLowerCase(),
            isSuccessful: status.toLowerCase() === 'success'
        };
    }

    async verifyTransaction(tx_ref) {
        try {
            const response = await this.client.get(`/transaction/verify/${tx_ref}`);
            return response.data;
        } catch (error) {
            throw new CustomError(
                'Failed to verify transaction',
                error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR
            );
        }
    }

    async getStoredPaymentInfo(tx_ref) {
        try {
            const transaction = await this.verifyTransaction(tx_ref);
            const meta = transaction.data?.meta || {};
            if (meta.quantity) meta.quantity = parseInt(meta.quantity, 10);
            return meta;
        } catch {
            return null;
        }
    }

    async completeTicketPurchase({ eventId, ticketType, quantity, userId, transactionReference }) {
        const event = await Event.findById(eventId);
        if (!event) throw new CustomError('Event not found', StatusCodes.NOT_FOUND);

        let ticketTypeDoc;
        if (ticketType && ticketType._id) {
            ticketTypeDoc = event.ticketTypes.id(ticketType._id);
        } else if (ticketType && (ticketType.name || typeof ticketType === 'string')) {
            const typeName = ticketType.name || ticketType;
            ticketTypeDoc = event.ticketTypes.find(tt => tt.name === typeName);
        } else if (!ticketType && event.ticketTypes.length > 0) {
            ticketTypeDoc = event.ticketTypes.find(tt => tt.quantity > 0) || event.ticketTypes[0];
        } else {
            throw new CustomError('Invalid ticket type data', StatusCodes.BAD_REQUEST);
        }

        if (!ticketTypeDoc) throw new CustomError('Ticket type not found', StatusCodes.NOT_FOUND);

        const now = new Date();
        if ((ticketTypeDoc.endDate && new Date(ticketTypeDoc.endDate) <= now) || ticketTypeDoc.available === false) {
            throw new CustomError('This ticket type is no longer available', StatusCodes.BAD_REQUEST);
        }

        if (ticketTypeDoc.quantity < quantity) {
            throw new CustomError(`Not enough tickets available. Only ${ticketTypeDoc.quantity} tickets remaining`, StatusCodes.BAD_REQUEST);
        }

        const tickets = [];
        for (let i = 0; i < quantity; i++) {
            const ticket = new Ticket({
                event: eventId,
                ticketType: ticketTypeDoc.name,
                user: userId,
                price: ticketTypeDoc.price,
                status: 'active',
                purchaseDate: new Date(),
                paymentReference: transactionReference
            });
            await ticket.save();
            tickets.push(ticket);
        }

        ticketTypeDoc.quantity -= quantity;
        await event.save();

        return {
            success: true,
            tickets: tickets.map(ticket => ({
                _id: ticket._id,
                ticketId: ticket.ticketId,
                ticketType: ticket.ticketType,
                price: ticket.price,
                status: ticket.status,
                purchaseDate: ticket.purchaseDate,
                qrCode: ticket.qrCode,
                paymentReference: ticket.paymentReference
            }))
        };
    }
}

module.exports = new PaymentService();
