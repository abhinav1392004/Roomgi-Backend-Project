const { Worker } = require("bullmq");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");

const Booking = require("../model/user/booking");
const PropertyBranch = require("../model/owner/propertyBranch");
const Tenant = require("../model/branchmanager/tenants");
const Payment = require("../model/payment");
const redis = require("../utils/a"); // ioredis again


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const paymentWorker = new Worker(
  "paymentQueue",
  async (job) => {
    console.log("🔥 Payment Worker triggered");
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { razorpay_payment_id, bookingId } = job.data;
      console.log("Job Data:", { razorpay_payment_id, bookingId });

      /* ---------- FETCH PAYMENT ---------- */
      console.log("Fetching payment from Razorpay...");
      const payment = await razorpay.payments.fetch(razorpay_payment_id);
      console.log("Payment fetched:", payment);

      if (payment.status !== "captured") {
        throw new Error("Payment not captured");
      }
      console.log("✅ Payment is captured");

      /* ---------- IDEMPOTENCY ---------- */
      console.log("Checking if payment already processed...");
      const alreadyProcessed = await Payment.findOne({ razorpay_payment_id });
      if (alreadyProcessed) {
        console.log("⚠️ Payment already processed, skipping");
        await session.abortTransaction();
        return;
      }

      /* ---------- BOOKING ---------- */
      console.log("Fetching booking info...");
      const booking = await Booking.findOne({ bookingId, status: "processing" }).session(session);
      if (!booking) throw new Error("Booking not found");
      console.log("Booking found:", booking);

      /* ---------- BRANCH ---------- */
      console.log("Fetching branch info...");
      const branch = await PropertyBranch.findById(booking.branch).session(session);
      if (!branch) throw new Error("Branch not found");
      console.log("Branch found:", branch.name);

      const room = branch.rooms.find((r) => r.roomNumber === booking.roomNumber);
      if (!room) throw new Error("Room not found");
      console.log("Room found:", room.roomNumber);

      /* ---------- TENANT ---------- */
      console.log("Creating tenant record...");
      const tenant = await Tenant.create(
        [
          {
            branch: branch._id,
            tenantId: booking.userId,
            roomNumber: room.roomNumber,
            securityDeposit: booking.securityDeposit,
            advanced: room.price,
            rent: room.price || room.rentperday || room.rentperNight || room.rentperhour,
            email: booking.email,
            name: booking.username,
          },
        ],
        { session }
      );
      console.log("Tenant created:", tenant[0]._id);

      /* ---------- PAYMENT ---------- */
      console.log("Recording payment in database...");
      await Payment.create(
        [
          {
            tenantId: tenant[0]._id,
            razorpay_payment_id,
            razorpay_order_id,
            roomNumber: room.roomNumber,
            mode: "online",
            status: "paid",
            amountpaid: booking.amount.payableAmount,
            walletused: booking.amount.walletUsed || 0,
            totalAmount: booking.amount.totalAmount,
            email: booking.email,
            branch: branch._id,
            rent: room.price,
            paymentInMonth: new Date().toISOString().slice(0, 7),
            paymentStatus:"success"
          },
        ],
        { session }
      );
        booking.status = "paid";
      await booking.save({ session });
   
        await Promise.allSettled([
        redis.del("all-pg"),
        redis.del(`tenant-branch-${branch._id}`),
        redis.del(`room-${branch._id}-${booking.room}`),
      ]);
          await session.commitTransaction();
      console.log("🚀 Payment processing completed successfully:", razorpay_payment_id);

    } catch (error) {
      await session.abortTransaction();
      console.error("❌ Worker error:", error.message, error);
    } finally {
      session.endSession();
      console.log("Session ended");
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

module.exports = paymentWorker;
