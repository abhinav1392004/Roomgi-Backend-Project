const mongoose = require("mongoose");

const expensesSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["Electricity", "Water Bill", "WiFi", "Maintenance", "Other"],
      default: "Other",
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyBranch",
      index: true,
    },

    amount: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);


expensesSchema.index({ branchId: 1, category: 1 });


expensesSchema.index({ branchId: 1 });


expensesSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Expenses", expensesSchema);
