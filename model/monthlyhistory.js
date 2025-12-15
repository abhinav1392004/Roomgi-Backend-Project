const mongoose = require("mongoose");

const MonthlyHistorySchema = new mongoose.Schema({
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PropertyBranch",
        required: true,
        index: true
    },

    month: {
        type: Number,
        index: true
    },

    year: {
        type: Number, 
        index: true
    },

    rent: {
        type: Number,
        default: 0
    },

    dues: {
        type: Number,
        default: 0
    },

    advanced: {
        type: Number,
        default: 0
    },

    NotPaid: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tenant",
        }
    ],

}, { timestamps: true });


MonthlyHistorySchema.index(
    { branch: 1, month: 1, year: 1 },
  
);

// Additional indexes for faster queries
MonthlyHistorySchema.index({ year: 1 });
MonthlyHistorySchema.index({ month: 1 });

module.exports = mongoose.model("PaymentHistory", MonthlyHistorySchema);
