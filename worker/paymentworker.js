const { Worker } = require("bullmq");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");

const Booking = require("../model/user/booking");
const PropertyBranch = require("../model/owner/propertyBranch");
const Tenant = require("../model/branchmanager/tenants");
const Payment = require("../model/payment");
const redis = require("../utils/a");

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
      const { razorpay_payment_id, razorpay_order_id } = job.data;

      console.log("Job Data:", { razorpay_payment_id, razorpay_order_id });

      /* ---------- FETCH PAYMENT ---------- */
      const payment = await razorpay.payments.fetch(razorpay_payment_id);

      if (payment.status !== "captured") {
        throw new Error("Payment not captured");
      }

      console.log("✅ Payment is captured");

      /* ---------- IDEMPOTENCY CHECK ---------- */
      const alreadyProcessed = await Payment.findOne({ razorpay_payment_id });
      if (alreadyProcessed) {
        console.log("⚠️ Payment already processed");
        await session.abortTransaction();
        return;
      }

      /* ---------- FETCH BOOKING ---------- */
      const booking = await Booking.findOne({
        razorpay_order_id,
        status: "processing",
      }).session(session);

      if (!booking) throw new Error("Booking not found");

      console.log("Booking found:", booking._id);

      /* ---------- FETCH BRANCH ---------- */
      const branch = await PropertyBranch.findById(booking.branch).session(session);
      if (!branch) throw new Error("Branch not found");

      /* ---------- FIND ROOM ---------- */
      const room = branch.rooms.find(
        (r) => String(r.roomNumber) === String(booking.roomNumber)
      );

      if (!room) throw new Error("Room not found");

      console.log("Room found:", room.roomNumber);

      /* ---------- DUPLICATE TENANT CHECK ---------- */
      const existingTenant = await Tenant.findOne({
        tenantId: booking.userId,
        branch: branch._id,
        roomNumber: room.roomNumber,
      }).session(session);

      let tenant;

      if (existingTenant) {
        console.log("⚠️ Tenant already exists, skipping creation");
        tenant = [existingTenant];
      } else {
        /* ---------- CREATE TENANT ---------- */
        tenant = await Tenant.create(
          [
            {
              branch: branch._id,
              tenantId: booking.userId,
              roomNumber: room.roomNumber,
              securityDeposit: booking.securityDeposit,
              advanced: room.price,
              rent:
                room.price ||
                room.rentperday ||
                room.rentperNight ||
                room.rentperhour,
              email: booking.email,
              name: booking.username,
            },
          ],
          { session }
        );

        console.log("Tenant created:", tenant[0]._id);

        /* ---------- UPDATE ROOM OCCUPANCY ---------- */
        room.occupied = (room.occupied || 0) + 1;
        branch.markModified("rooms");
        await branch.save({ session });
      }

      /* ---------- CREATE PAYMENT RECORD ---------- */
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
            paymentStatus: "success",
          },
        ],
        { session }
      );

      /* ---------- UPDATE BOOKING ---------- */
      booking.status = "paid";
      await booking.save({ session });

      /* ---------- CLEAR CACHE ---------- */
      await Promise.allSettled([
        redis.del("all-pg"),
        redis.del(`tenant-branch-${branch._id}`),
        redis.del(`room-${branch._id}-${booking.roomNumber}`),
      ]);

      await session.commitTransaction();
      console.log("🚀 Payment processing completed:", razorpay_payment_id);
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
