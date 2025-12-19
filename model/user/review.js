const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    // Branch in which room exists
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyBranch",
      required: true,
    },

    // Room being reviewed
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
    
      required: true,
    },

    // User who reviewed (only after checkout)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Signup",
      required: true,
    },

    // Rating (1–5)
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    // Optional text review
    review: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Ensures only booked users can review
    isVerified: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);



module.exports = mongoose.model("Review", reviewSchema);
