const crypto = require("crypto");
const { paymentQueue } = require("../queue")

exports.paymentWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Use raw body for signature verification
    const signature = req.headers["x-razorpay-signature"];
    const body = req.rawBody || JSON.stringify(req.body); // rawBody should be set by middleware

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }


    const event = req.body;


    a
    await paymentQueue.add("razorpay-event", {
      event,
    });


    res.status(200).json({ success: true, message: "Webhook received" });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
