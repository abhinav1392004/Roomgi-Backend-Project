const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema({
    title: { type: String, required: true },
  description: String,
  category: { type: String, enum: ["Electrical", "Plumbing", "Cleaning", "Other"], default: "Other" },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: "PropertyBranch" },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Signup" },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "staff" },
  status: { type: String, enum: ["Pending", "In-Progress", "Resolved"], default: "Pending" },

}, { timestamps: true });


complaintSchema.index({ category: 1 });
complaintSchema.index({ branchId: 1,status: 1 });
complaintSchema.index({ tenantId: 1,status: 1 });





module.exports = mongoose.model("Complaint", complaintSchema);
