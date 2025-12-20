const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
     
        index: true   // 🔥 fast tenant-history search
    },

    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PropertyBranch",
    
        index: true   // 🔥 branch-wise payment search
    },
    roomNumber: {
        type: Number,
    },
    razorpay_order_id: {
        type: String,
        index: true
    },

    razorpay_payment_id: {
        type: String,
        index: true
    },
    amountpaid: {
        type: Number,
    }, walletused: {
        type: Number,
        default:0
    }, totalAmount: {
        type: Number,
    }, 
  paymentStatus: {
  type: String,
  enum: ["success","processing", "failed", "refunded"],
  required: true,
},



    email: {
        type: String
    },

    mode: {
        type: String,
        enum: ["online", "offline"],
        default: "offline"
    },

    paymentInMonth: {
        type: String, // "Jan-2025"
        index: true
    },

  
    status: {
        type: String,
        enum: ["paid", "dues", "over-dues"],
        default: "paid",
        index: true
    },
}, { timestamps: true });


PaymentSchema.index({ tenantId: 1, branch: 1, date: -1 });



PaymentSchema.index({ razorpay_order_id: 1, razorpay_payment_id: 1 });


module.exports = mongoose.model("Payment", PaymentSchema);
