const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema({
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PropertyBranch",
        required: true
    },
    branchmanager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "branchmanager"
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Signup"
    },
    name: {
        type: String,
    },
    email:{
         type: String,
    },
    mode: {
        type: String,
        enum: ["online", "offline"],
        default: "online",
    },
     reviewed:{
            type:Boolean,
            default:false
    
        },

    contactNumber: {
        type: String,

    },
    emergencyContactNumber: {
        type: String
    },
    roomNumber: {
        type: Number
    },
    checkInDate: {
        type: Date,
        default: Date.now
    },
    checkedoutdate: {
        type: Date
    },
    rent: {
        type: Number,
        default: 0
    },
    dues: {
        type: Number,
        default: 0
    },
    duesdays: {
        type: Number,
        default: 0
    },
    duesmonth: {
        type: Number,
        default: 0
    },
    advanced: {
        type: Number,
        default: 0
    },
    startdues: {
        type: Date,
        default: null
    },
    paymentstatus: {
        type: String,
        enum: ["paid", "dues", "over-dues"],
        default: "paid"
    },
    securitydeposit: {
        type: Number,
        default: 0
    },
    idProof: {
        type: String
    },
    idProofType: {
        type: String,
        enum: ["Aadhar-Card", "Voter-Id-Card"]
    },
    status: {
        type: String,
        enum: ["Active", "In-Active"],
        default: "Active"
    },
    documentsPhoto: {
        type: [String] // Flexible for multiple documents
    },

    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});


tenantSchema.index({ branch: 1, roomNumber: 1 });
tenantSchema.index({ contactNumber: 1, name: 1 });
tenantSchema.index({ status: 1, paymentStatus: 1 });

module.exports = mongoose.model("Tenant", tenantSchema);
