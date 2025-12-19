const { Worker } = require("bullmq");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");

const Booking = require("../models/booking.model");
const PropertyBranch = require("../models/propertyBranch.model");
const Tenant = require("../models/tenant.model");
const Payment = require("../models/payment.model");
const redis = require("../utils/redis");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const paymentWorker = new Worker(
  "paymentQueue",
  async (job) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { razorpay_payment_id, bookingId } = job.data;

      /* ---------- FETCH PAYMENT ---------- */
      const payment = await razorpay.payments.fetch(
        razorpay_payment_id
      );

      if (payment.status !== "captured") {
        throw new Error("Payment not captured");
      }

      /* ---------- IDEMPOTENCY ---------- */
      const alreadyProcessed = await Payment.findOne({
        razorpay_payment_id,
      });

      if (alreadyProcessed) {
        await session.abortTransaction();
        return;
      }

      /* ---------- BOOKING ---------- */
      const booking = await Booking.findOne({
        bookingId,
        status: "processing",
      }).session(session);

      if (!booking) throw new Error("Booking not found");

      /* ---------- BRANCH ---------- */
      const branch = await PropertyBranch.findById(
        booking.branch,
      ).session(session);

      if (!branch) throw new Error("Branch not found");

      const room = branch.rooms.find(
        (r) => r.roomNumber === booking.roomNumber
      );

      if (!room) throw new Error("Room not found");

      /* ---------- TENANT ---------- */
      const tenant = await Tenant.create(
        [
          {
            tenantId: booking.userId,
            roomNumber: room.roomNumber,
            branch: branch._id,
            email: booking.email,
            rent:
              room.price ||
              room.rentperday ||
              room.rentperNight ||
              room.rentperhour,
            name: booking.username,
          },
        ],
        { session }
      );

      /* ---------- PAYMENT ---------- */
      await Payment.create(
        [
          {
            tenantId: tenant[0]._id,
            razorpay_payment_id,
            roomNumber: room.roomNumber,
            mode: "Online",
            status: "paid",
            amountpaid: booking.amount.payableAmount,
            walletused: booking.amount.walletUsed || 0,
            totalAmount: booking.amount.totalAmount,
            email: booking.email,
            branch: branch._id,
          },
        ],
        { session }
      );

      /* ---------- UPDATE BOOKING ---------- */
      booking.status = "paid";
      await booking.save({ session });

      /* ---------- REDIS CLEANUP ---------- */
      await Promise.allSettled([
        redis.del("all-pg"),
        redis.del(`tenant-branch-${branch._id}`),
        redis.del(`room-${branch._id}-${booking.room}`),
      ]);

      await session.commitTransaction();
      console.log("✅ Payment processed:", razorpay_payment_id);

    } catch (error) {
      await session.abortTransaction();
      console.error("❌ Worker error:", error.message);
    } finally {
      session.endSession();
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

module.exports = paymentWorker;
