const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema({
  /* ================= BASIC INFO ================= */
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PropertyBranch",
    required: true,
    index: true
  },

  branchmanager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BranchManager"
  },

  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Signup"
  },

  name: String,
  email: String,

  contactNumber: String,
  emergencyContactNumber: String,

  /* ================= ROOM INFO ================= */
  roomNumber: {
    type: Number,
    index: true
  },
      checkedoutdate: {
        type: Date
    },

  checkInDate: {
    type: Date,
    default: Date.now
  },
    lastDuesCalculatedAt: Date,


  status: {
    type: String,
    enum: ["Active", "In-Active"],
    default: "Active"
  },

  /* ================= FINANCE SNAPSHOT ================= */
  rent: {
    type: Number,
    default:1,
    required: true
  },



  advanced: {
    type: Number,
    default: 0
  },

  securityDeposit: {
    type: Number,
    default: 0
  },

  duesamount: {
    type: Number,
    default: 0
  },

  duesmonth: {
    type: Number,
    default: 0
  },

  duesdays: {
    type: Number,
    default: 0
  },

  startDuesFrom: {
    type: Date,
    default: null
  },

  paymentStatus: {
    type: String,
    enum: ["paid", "dues"],
    default: "paid",
    index: true
  },

  /* ================= DOCUMENTS ================= */
  idProofType: {
    type: String,
    enum: ["Aadhar-Card", "Voter-Id-Card"]
  },

  idProof: String,

  documentsPhoto: [String],

  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }

}, { timestamps: true });

/* ================= INDEXES ================= */
tenantSchema.index({ branch: 1, roomNumber: 1 });
tenantSchema.index({ contactNumber: 1 });
tenantSchema.index({ status: 1, paymentStatus: 1 });

module.exports = mongoose.model("Tenant", tenantSchema);
