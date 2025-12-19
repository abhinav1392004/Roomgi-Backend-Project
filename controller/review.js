

const Payment = require("../model/branchmanager/payment")
const PropertyBranch = require("../model/owner/propertyBranch")
const Expense = require("../model/branchmanager/expenses")
const Tenant = require("../model/branchmanager/tenants")
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Signup = require("../model/user")
const redisClient = require("../utils/redis");
const Review = require("../model/user/review")
const mongoose = require("mongoose")


exports.createreview = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  const abort = async (status, message) => {
    await session.abortTransaction();
    session.endSession();
    return res.status(status).json({ success: false, message });
  };

  try {
    const { roomId, rating, review } = req.body;
    const userId = req.user._id;

    if (!roomId || rating == null) {
      return abort(400, "RoomId and rating are required");
    }

    const numericRating = Number(rating);
    if (numericRating < 1 || numericRating > 5) {
      return abort(400, "Rating must be between 1 and 5");
    }

    // 1️⃣ Check duplicate review
    const existingReview = await Review.findOne(
      { roomId, user: userId },
      null,
      { session }
    );

    if (existingReview) {
      return abort(409, "You have already reviewed this room");
    }

    // 2️⃣ Find branch FIRST (🔥 IMPORTANT)
    const branch = await PropertyBranch.findOne(
      { "rooms._id": roomId },
      { _id: 1, "rooms.$": 1 },
      { session }
    );

    if (!branch) {
      return abort(404, "Room not found");
    }

    // 3️⃣ Create review WITH branchId ✅
    const [reviewDoc] = await Review.create(
      [{
        roomId,
        user: userId,
        branchId: branch._id, // 🔥 FIX
        rating: numericRating,
        review,
      }],
      { session }
    );

    // 4️⃣ Update room ratings
    await PropertyBranch.updateOne(
      { "rooms._id": roomId },
      {
        $push: { "rooms.$.personalreview": reviewDoc._id },
        $inc: {
          "rooms.$.totalrating": numericRating,
          "rooms.$.ratingcount": 1,
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // 5️⃣ Redis cache invalidation
    if (redisClient?.isOpen) {
      await redisClient.del("all-pg");

      const tenantKeys = await redisClient.keys(`tenant-${userId}-*`);
      const branchKeys = await redisClient.keys(`branch-${branch._id}-*`);

      if (tenantKeys.length) await redisClient.del(tenantKeys);
      if (branchKeys.length) await redisClient.del(branchKeys);
    }

    const room = branch.rooms[0];

    return res.status(201).json({
      success: true,
      message: "Review added successfully",
      averageRating: Number(
        ((room.totalrating + numericRating) / (room.ratingcount + 1)).toFixed(1)
      ),
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Create review error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


exports.getAllreview = async (req, res) => {

  try {
    const { roomId } = req.params;

    const reviews = await Review.find({ roomId: roomId });

    if (reviews.length <= 0) {
      return res.status(400).json({
        success: false,
        message: "Not have any reviewd till now"
      })
    }

    return res.status.json({
      success: true,
      message: "all reviews of this branch are ",
      reviews: reviews
    })

  } catch (error) {
    console.error("Create review error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}