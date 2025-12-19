const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        /* ---------- BASIC BOOKING INFO ---------- */
        bookingId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        email: {
            type: String
        },
        username: {
            type: String
        },

        branch: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PropertyBranch",
            required: true,
        },
        


        roomNumber: {
            type: Number,

            required: true,
        },

        /* ---------- PAYMENT DETAILS ---------- */
        status: {
            type: String,
            enum: ["pending", "paid", "cancelled", "refunded","processing"],
            default: "pending",
            index: true,
        },

        paymentSource: {
            type: String,
            enum: ["online", "offline"],
            required: true,
        },
        amount: {
            totalAmount: Number,
            payableAmount: Number,
            walletUsed: Number,
        },


        /* ---------- RAZORPAY (ONLY ONLINE) ---------- */
        razorpay: {
            orderId: String,
            paymentId: String,
            signature: String,
        },

        /* ---------- OFFLINE INFO ---------- */
        collectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // owner/admin
        },

        /* ---------- BOOKING DATES ---------- */
        bookingDate: {
            type: Date,
            default: Date.now,
        },

        checkInDate: Date,
        checkOutDate: Date,

        /* ---------- AUDIT / META ---------- */
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        notes: String,
    },
    { timestamps: true }
);

/* ---------- INDEXES ---------- */
bookingSchema.index({ tenant: 1, status: 1 });
bookingSchema.index({ branch: 1 });


module.exports = mongoose.model("Booking", bookingSchema);
