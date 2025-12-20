const mongoose = require("mongoose");

const AnnouncementSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyBranch",
      required: true,
      index: true
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null // null = visible to all tenants
    },

    title: {
      type: String,
      required: true
    },

    message: {
      type: String,
      required: true
    },

    type: {
      type: String,
      enum: ["info", "warning", "urgent"],
      default: "info",
      index: true
    },

    postedBy: {
      type: String,
      default: "Admin"
    },

    expiresAt: {
      type: Date // auto remove notice
    }
  },
  { timestamps: true }
);

AnnouncementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Announcement", AnnouncementSchema);
