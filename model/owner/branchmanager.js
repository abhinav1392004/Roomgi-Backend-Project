const mongoose = require("mongoose");

const branchManagerSchema = new mongoose.Schema(
    {
        propertyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PropertyBranch",
            required: true,
        },

        name: {
            type: String,
        },

        pwdchanged: {
            type: Boolean,
            default: false,
        },

        email: {
            type: String,
        },

        phone: {
            type: Number,
        },

        status: {
            type: String,
            enum: ["Active", "In-Active"],
            default: "Active",
        }
    },
    { timestamps: true }
);


branchManagerSchema.index({ email: 1 });
branchManagerSchema.index({ phone: 1 });
branchManagerSchema.index({ name: 1 });


branchManagerSchema.index({ propertyId: 1, status: 1 });

module.exports = mongoose.model("branchmanager", branchManagerSchema);
