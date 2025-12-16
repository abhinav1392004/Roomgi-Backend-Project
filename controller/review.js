

const Payment = require("../model/payment")
const PropertyBranch = require("../model/propertyBranch")
const Expense = require("../model/expenses")
const Tenant = require("../model/tenants")
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Signup = require("../model/user")
const redisClient = require("../utils/redis");
const Review = require("../model/review")
const mongoose = require("mongoose")


exports.createreview = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { roomId, rating, review } = req.body;
    const userId = req.user._id;

    // 1️⃣ Validation
    if (!roomId || rating == null) {
      return res.status(400).json({
        success: false,
        message: "RoomId and rating are required",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // 2️⃣ Prevent duplicate review
    const existingReview = await Review.findOne(
      { roomId, user: userId },
      null,
      { session }
    );

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this room",
      });
    }

    // 3️⃣ Create review first
    const reviewDoc = await Review.create(
      [
        {
          roomId,
          user: userId,
          rating,
          review,
        },
      ],
      { session }
    );

    const reviewId = reviewDoc[0]._id;

    // 4️⃣ ATOMIC room update (🔥 THIS IS THE KEY FIX)
    const updatedBranch = await PropertyBranch.findOneAndUpdate(
      { "rooms._id": roomId },
      {
        $push: { "rooms.$.personalreview": reviewId },
        $inc: {
          "rooms.$.totalrating": rating,
          "rooms.$.ratingcount": 1,
        },
      },
      { new: true, session }
    );

    if (!updatedBranch) {
      await Review.findByIdAndDelete(reviewId, { session });
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // 5️⃣ Update branchId inside review (optional but clean)
    await Review.findByIdAndUpdate(
      reviewId,
      { branchId: updatedBranch._id },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // 6️⃣ Redis cache invalidation (safe)
    if (redisClient?.isOpen) {
      await Promise.allSettled([
        redisClient.del(`tenant-${userId}-*`),
        redisClient.del(`branch-${updatedBranch._id}-*`),
      ]);
    }

    // 7️⃣ Calculate average rating
    const room = updatedBranch.rooms.find(
      r => r._id.toString() === roomId.toString()
    );

    const averageRating =
      room.totalrating / room.ratingcount;

    return res.status(201).json({
      success: true,
      message: "Review added successfully",
      averageRating: Number(averageRating.toFixed(1)),
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