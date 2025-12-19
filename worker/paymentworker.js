const { Worker } = require("bullmq");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");

const Booking = require("../models/booking.model");
const PropertyBranch = require("../models/propertyBranch.model");
const Tenant = require("../models/tenant.model");
const Payment = require("../models/payment.model");
const { redis } = require("../utils/redis");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const paymentWorker = new Worker(
  "paymentQueue",
  async (job) => {
    console.log("📥 Received job:", job.id, job.data.event?.event);

    const event = job.data.event;
    const payment = event.payload?.payment?.entity;

    if (!payment) {
      console.warn("⚠️ No payment data found in event");
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log("🔍 Processing event:", event.event);

      switch (event.event) {
        case "payment.captured": {
          console.log("💰 Payment captured:", payment.id);

          const booking = await Booking.findOne({
            "razorpay.paymentId": payment.id,
            status: "pending",
          }).session(session);

          if (!booking) {
            console.error("❌ Booking not found for payment:", payment.id);
            throw new Error("Booking not found");
          }
          console.log("📦 Booking found:", booking.bookingId);

          const branch = await PropertyBranch.findOne({
            "rooms._id": booking.room,
          }).session(session);
          const room = branch.rooms.id(booking.room);

          if (room.occupied >= room.capacity) {
            console.warn("⚠️ Room full:", room.roomNumber);
            throw new Error("Room full");
          }

          // Update room occupancy
          room.occupied += 1;
          room.vacant = room.capacity - room.occupied;
          room.availabilityStatus = room.vacant === 0 ? "Occupied" : "Available";
          branch.markModified("rooms");
          await branch.save({ session });
          console.log("🏠 Room updated:", room.roomNumber);

          // Create tenant
          const tenant = await Tenant.create(
            [
              {
                tenantId: booking.userId,
                roomNumber: room.roomNumber,
                branch: branch._id,
                email: booking.email,
                Rent: room.price || room.rentperday || room.rentperNight || room.rentperhour,
                name: booking.username,
              },
            ],
            { session }
          );
          console.log("🧑 Tenant created:", tenant[0]._id);

          // Create payment record
          await Payment.create(
            [
              {
                tenantId: tenant[0]._id,
                razorpay_payment_id: payment.id,
                roomId: booking.room,
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
          console.log("💳 Payment record created for:", payment.id);

          // Confirm booking
          booking.status = "paid";
          await booking.save({ session });
          console.log("✅ Booking confirmed:", booking.bookingId);
          break;
        }

        case "payment.failed": {
          console.log("❌ Payment failed:", payment.id);
          await Booking.updateOne(
            { "razorpay.paymentId": payment.id },
            { status: "failed" },
            { session }
          );
          break;
        }

        case "payment.refunded": {
          console.log("💸 Payment refunded:", payment.id);
          await Booking.updateOne(
            { "razorpay.paymentId": payment.id },
            { status: "refunded" },
            { session }
          );
          break;
        }

        default:
          console.log("ℹ️ Unhandled event type:", event.event);
      }

      await session.commitTransaction();
      session.endSession();
      console.log("🎉 Event processed successfully:", event.event);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("⚠️ Worker error:", err.message);

      if (event.event === "payment.captured") {
        try {
          console.log("💸 Attempting refund due to error for payment:", payment.id);
          await razorpay.payments.refund(payment.id, { amount: payment.amount });
          console.log("✅ Refund successful for payment:", payment.id);
        } catch (refundError) {
          console.error(
            "❌ Refund failed for payment:",
            payment.id,
            refundError.message
          );
        }
      }
    }
  },
  { connection: redis }
);
