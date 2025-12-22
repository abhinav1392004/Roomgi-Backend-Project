const { Worker } = require("bullmq");
const redis = require("../utils/a");
const Razorpay = require("razorpay");
const Booking = require("../model/user/booking");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

new Worker(
  "refund", // ✅ SAME AS QUEUE NAME
  async () => {
    console.log("🔁 Refund worker started");

    const cursor = Booking.find({
      status: { $in: ["processing", "refund_failed", "refund_initiated"] }
    }).cursor();

    for (
      let booking = await cursor.next();
      booking;
      booking = await cursor.next()
    ) {
      try {
        console.log("\n💸 Booking:", booking._id);
        console.log("💳 Payment:", booking.razorpay.paymentId);

        const paymentId = booking.razorpay.paymentId;

        // 1️⃣ Fetch payment
        const payment = await razorpay.payments.fetch(paymentId);
        console.log("📌 Payment status:", payment.status);

        if (payment.status !== "captured" && payment.status !== "refunded") {
          console.log("❌ Payment not refundable");
          continue;
        }

        // 2️⃣ If refund already exists → check status
        if (booking.razorpay.refundId) {
          const refund = await razorpay.refunds.fetch(
            booking.razorpay.refundId
          );

          console.log("🔎 Refund status:", refund.status);

          booking.razorpay.refundStatus = refund.status;

          if (refund.status === "processed") {
            booking.status = "refunded";
          } else if (refund.status === "failed") {
            booking.status = "refund_failed";
          } else {
            booking.status = "refund_initiated"; // pending
          }

          await booking.save();
          continue;
        }

        // 3️⃣ No refund yet → create refund
        const refundAmountPaise = Math.round(
          booking.amount.payableAmount * 100
        );

        const refund = await razorpay.payments.refund(paymentId, {
          amount: refundAmountPaise
        });

        console.log("✅ Refund created:", refund.id);

        booking.status = "refund_initiated";
        booking.razorpay.refundId = refund.id;
        booking.razorpay.refundStatus = refund.status;
        booking.razorpay.refundAmount = refund.amount / 100;

        await booking.save();

      } catch (err) {
        booking.status = "refund_failed";
        await booking.save();

        console.error(
          "❌ Refund error:",
          err?.error?.description || err.message
        );
      }
    }

    console.log("🏁 Refund worker finished");
  },
  { connection: redis, concurrency: 1 }
);
