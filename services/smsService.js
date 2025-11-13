let twilio;
try {
  twilio = require("twilio");
} catch (err) {
  twilio = null;
  console.warn("Twilio package not installed");
}

class SMSService {
  constructor() {
    this.client = null;
    this.fromNumber = null;
    this.initialize();
  }

  initialize() {
    try {
      if (twilio && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        this.client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
      } else {
        console.warn(
          "Twilio credentials not found. SMS service will fall back to ClickSend."
        );
        this.client = null;
        this.fromNumber = null;
      }
    } catch (error) {
      console.error("Error initializing Twilio client:", error.message);
      this.client = null;
      this.fromNumber = null;
    }
  }

  isReady() {
    return Boolean(this.client && this.fromNumber);
  }

  async send2FACode(phoneNumber, code) {
    if (!this.isReady()) {
      return { success: false, error: "Twilio not configured" };
    }

    const validPhoneNumber = this.formatPhoneNumber(phoneNumber);
    const message = `Your verification code is: ${code}`;

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: validPhoneNumber,
      });

      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error("Error sending SMS via Twilio:", error.message);
      return { success: false, error: error.message };
    }
  }

  formatPhoneNumber(phoneNumber = "") {
    const clean = phoneNumber.replace(/\D/g, "");
    if (phoneNumber.startsWith("+")) return phoneNumber;
    if (clean.startsWith("1") && clean.length === 11) return `+${clean}`;
    if (clean.length === 10) return `+1${clean}`;
    return `+${clean}`;
  }
}

module.exports = new SMSService();

