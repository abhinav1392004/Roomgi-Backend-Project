const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  role: {
    type: String,
    enum: ["Manager", "Security", "Maintenance", "Cleaning"],
  },
  branches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "PropertyBranch",
    required: true
  }],
  inService: {
    type: Date,
    default: Date.now
  },
  outService: {
    type: Date
  },
  contact: {
    type: String,

  },
  email: {
    type: String,
  },
  permissions: [{
    type: String
  }],
  status: {
    type: String,
    enum: ["Active", "In-Active"],
    default: "Active"
  },
  // metadata: { // scalable field for future extensions
  //   type: mongoose.Schema.Types.Mixed,
  //   default: {}
  // },
  assignmentHistory: [
    {
      branch: { type: mongoose.Schema.Types.ObjectId, ref: "PropertyBranch" },
      assignedOn: { type: Date, default: Date.now },
      removedOn: { type: Date }
    }
  ]
}, {
  timestamps: true
});


staffSchema.index({ branches: 1, role: 1 });
staffSchema.index({ contact: 1, email: 1 });
staffSchema.index({ status: 1, role: 1 });

module.exports = mongoose.model("Staff", staffSchema);
