const { Worker } = require("bullmq");
const redis  = require("../utils/a");
const Razorpay = require("razorpay");
const Booking = require("../model/user/booking");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

new Worker(
  "REFUND_VERIFY",
  async () => {
    console.log("🔍 Refund verification worker started for DB-refunded bookings");

    // Cursor for bookings which are marked as refunded in DB
    const cursor = Booking.find({
      status: "refunded",
      "razorpay.refundId": { $exists: true, $ne: null }
    }).cursor();

    for (
      let booking = await cursor.next();
      booking != null;
      booking = await cursor.next()
    ) {
      try {
        // Fetch payment from Razorpay
        const payment = await razorpay.payments.fetch(booking.razorpay.paymentId);

        // Check refunds array in Razorpay
        const refund = payment.refunds?.find(r => r.id === booking.razorpay.refundId);

        if (!refund) {
          console.log("❌ Refund ID not found in Razorpay for booking:", booking._id);
          continue;
        }

        // Verify actual refund status
        if (refund.status === "processed") {
          } else if (refund.status === "failed") {
          booking.status = "refund_failed"; // Update DB if actually failed
          await booking.save();
        } else {
            }

      } catch (err) {
            }
    }
  },
  { connection: redis, concurrency: 1 }
);
