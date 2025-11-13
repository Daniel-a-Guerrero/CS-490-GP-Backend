const axios = require("axios");

class ClickSendService {
  constructor() {
    this.username = process.env.CLICKSEND_USERNAME;
    this.apiKey =
      process.env.CLICKSEND_APIKEY || process.env.CLICKSEND_API_KEY || null;
    this.fromName = process.env.OTP_FROM_NAME || "StyGo";
  }

  hasCredentials() {
    return Boolean(this.username && this.apiKey);
  }

  async send2FACode(phoneNumber, code) {
    if (!this.hasCredentials()) {
      console.warn(
        "ClickSend credentials not found. SMS service will not be available."
      );
      return { success: false, error: "SMS service not available" };
    }

    const validPhoneNumber = this.formatPhoneNumber(phoneNumber);
    const message = `Your verification code is: ${code}. It expires in 5 minutes.`;

    try {
      const payload = {
        messages: [
          {
            source: "api",
            body: message,
            to: validPhoneNumber,
            from: this.fromName,
          },
        ],
      };

      const auth = Buffer.from(`${this.username}:${this.apiKey}`).toString(
        "base64"
      );
      const response = await axios.post(
        "https://rest.clicksend.com/v3/sms/send",
        payload,
        {
          headers: { Authorization: `Basic ${auth}` },
          timeout: 15000,
        }
      );

      if (response.data.http_code !== 200) {
        throw new Error(`SMS failed: ${JSON.stringify(response.data)}`);
      }

      const first = response.data.data?.messages?.[0];
      if (!first || first.status !== "SUCCESS") {
        throw new Error(`SMS not successful: ${JSON.stringify(response.data)}`);
      }

      return { success: true, messageId: first.message_id };
    } catch (error) {
      console.error("ClickSend SMS error:", error.message);
      return { success: false, error: error.message };
    }
  }

  formatPhoneNumber(phoneNumber = "") {
    const clean = phoneNumber.replace(/\D/g, "");
    if (phoneNumber.startsWith("+")) return phoneNumber;
    return clean.length === 10 ? `+1${clean}` : `+${clean}`;
  }
}

module.exports = new ClickSendService();
