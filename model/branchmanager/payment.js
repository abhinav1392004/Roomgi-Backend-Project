const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
        required: true,
        index: true   // 🔥 fast tenant-history search
    },

    roomId: [{
        type: String,
    }],
    email:{
        type:String
    },

    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PropertyBranch",
        required: true,
        index: true   // 🔥 branch-wise payment search
    },

    mode: {
        type: String,
        enum: ["Online", "Offline"],
        default: "Offline"
    },

    tilldatestatus: {
        type: String,
        enum: ["paid", "dues", "over-dues"],
        default: "dues",
        index: true  
    },

    tilldateAdvance: {
        type: Number,
        default: 0
    },

    tilldatedues: {
        type: Number,
        default: 0
    },

    amountpaid: {
        type: Number,
    },

    razorpay_payment_id: {
        type: String,
        index: true   
    },

    date: {
        type: Date,
        default: Date.now,
        index: true   
    },

}, { timestamps: true });


PaymentSchema.index({ tenantId: 1, branch: 1, date: -1 });

PaymentSchema.index({ branch: 1, tilldatestatus: 1 });

PaymentSchema.index({ tenantId: 1, tilldatestatus: 1 });

PaymentSchema.index({ razorpay_order_id: 1, razorpay_payment_id: 1 });


module.exports = mongoose.model("Payment", PaymentSchema);
