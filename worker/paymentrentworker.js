const { Worker } = require("bullmq");
const mongoose = require("mongoose");

const Tenant = require("../model/branchmanager/tenants");
const Payment = require("../model/payment");
const redis = require("../utils/a"); // ioredis instance

const paymentWorker = new Worker(
  "adjust-rent",
  async (job) => {
    const { tenantId, amount, paymentId } = job.data;

    console.log("🔥 Payment Worker triggered:", job.id);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      /* ===========================
         1️⃣ FETCH TENANT & PAYMENT
      ============================ */
      const tenant = await Tenant.findById(tenantId).session(session);
      if (!tenant) throw new Error("Tenant not found");

      const payment = await Payment.findById(paymentId).session(session);
      if (!payment) throw new Error("Payment not found");

      let remainingAmount = amount;

      /* ===========================
         2️⃣ CLEAR OLD DUES FIRST
      ============================ */
      if (tenant.duesamount > 0) {
        const duesPaid = Math.min(tenant.duesamount, remainingAmount);
        tenant.duesamount -= duesPaid;
        remainingAmount -= duesPaid;
      }

      /* ===========================
         3️⃣ ADD REMAINING TO ADVANCE
      ============================ */
      if (remainingAmount > 0) {
        tenant.advanced = (tenant.advanced || 0) + remainingAmount;
      }

      /* ===========================
         4️⃣ UPDATE RENT & PAYMENT STATUS
      ============================ */
      if (tenant.duesamount === 0) {
        tenant.rentStatus = "paid";
        tenant.paymentStatus = "paid";

        // 🔑 calculate next dues start date using advance
        if (tenant.advanced > 0 && tenant.rent > 0) {
          const perDayRent = tenant.rent / 30;
          const coveredDays = Math.floor(tenant.advanced / perDayRent);

          const nextDuesDate = new Date();
          nextDuesDate.setDate(nextDuesDate.getDate() + coveredDays);

          tenant.startDuesFrom = nextDuesDate;
        }
      } else {
        tenant.paymentStatus = "dues";
        // ❗ startDuesFrom NOT touched here
      }

      /* ===========================
         5️⃣ SAVE TENANT
      ============================ */
      await tenant.save({ session });

      /* ===========================
         6️⃣ UPDATE PAYMENT RECORD
      ============================ */
      payment.paymentStatus = "success";
      payment.amountpaid = amount;
      payment.branch = tenant.branch;
      payment.roomNumber = tenant.roomNumber;

      await payment.save({ session });

      /* ===========================
         7️⃣ COMMIT TRANSACTION
      ============================ */
      await session.commitTransaction();
      console.log("✅ Rent adjusted & payment marked success");

    } catch (error) {
      await session.abortTransaction();

      // ❌ mark payment failed
      if (paymentId) {
        await Payment.findByIdAndUpdate(paymentId, {
          paymentStatus: "failed",
        });
      }

      console.error("❌ Worker error:", error.message);
      throw error; // BullMQ retry
    } finally {
      session.endSession();
      console.log("🛑 Worker session ended");
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

module.exports = paymentWorker;
