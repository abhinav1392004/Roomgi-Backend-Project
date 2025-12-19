const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room", 
    },
    pgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyBranch",
      index: true,
    },
    // Flexible field for future wishlist data
    // metadata: {
    //   type: mongoose.Schema.Types.Mixed,
    //   default: {},
    // },
    status: {
      type: String,
      enum: ["active", "removed"],
      default: "active"
    }
  },
  { timestamps: true }
);

wishlistSchema.index({ userId: 1, pgId: 1, roomId: 1 });

module.exports = mongoose.model("Wishlist", wishlistSchema);
