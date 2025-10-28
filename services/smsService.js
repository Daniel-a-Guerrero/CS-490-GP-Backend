const twilio = require('twilio');

class SMSService {
    constructor() {
        try {
            if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
                this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
            } else {
                console.warn('Twilio credentials not found. SMS service will not be available.');
                this.client = null;
                this.fromNumber = null;
            }
        } catch (error) {
            console.error('Error initializing Twilio client:', error.message);
            this.client = null;
            this.fromNumber = null;
        }
    }

    async send2FACode(phoneNumber, code, userName = 'User') {
        if (!this.client) {
            console.warn('SMS client not available. Skipping SMS send.');
            return { success: false, error: 'SMS service not available' };
        }
        
        const validPhoneNumber = this.formatPhoneNumber(phoneNumber);
        const message = `Your verification code is: ${code}`;
        
        console.log('Attempting to send SMS:');
        console.log('  From:', this.fromNumber);
        console.log('  To:', validPhoneNumber);
        console.log('  Message:', message);
        
        try {
            const result = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: validPhoneNumber
            });

            return { success: true, messageId: result.sid };
        } catch (error) {
            console.error('Error sending SMS:', error.message);
            console.error('Error code:', error.code);
            return { success: false, error: error.message };
        }
    }

    generateCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    formatPhoneNumber(phoneNumber) {
        const clean = phoneNumber.replace(/\D/g, '');
        
        if (phoneNumber.startsWith('+')) return phoneNumber;
        if (clean.startsWith('1') && clean.length === 11) return `+${clean}`;
        if (clean.length === 10) return `+1${clean}`;
        return `+${clean}`;
    }
}

module.exports = new SMSService();

