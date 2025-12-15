

const Payment = require("../model/payment")
const PropertyBranch = require("../model/propertyBranch")
const Expense = require("../model/expenses")
const Tenant = require("../model/tenants")
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Signup = require("../model/user")
const redisClient = require("../utils/redis");
const Review = require("../model/review")





exports.createreview = async (req, res) => {
    try {
        console.log(req.body)
        const { roomId, rating, review } = req.body;

        if (!roomId || !rating) {
            return res.status(400).json({
                success: false,
                message: "RoomId and rating are required",
            });
        }

        // Find branch having this room
        const branch = await PropertyBranch.findOne({
            "rooms._id": roomId,
        });

        if (!branch) {
            return res.status(404).json({
                success: false,
                message: "Branch or room not found",
            });
        }

        // Find room inside branch
        const room = branch.rooms.id(roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        const reviewd = await Review.create({
            branchId: branch._id,
            roomId: roomId,
            user: req.user._id,
            rating,
            review
        })


        room.totalrating += rating;
        room.ratingcount += 1;

        room.personalreview.push(
            reviewd._id,
        )


        await branch.save();


        await redisClient.del(`tenant-${req.user._id}-booking`);





        return res.status(201).json({
            success: true,
            message: "Review added successfully",
            averageRating: room.personalreview,
        });

    } catch (error) {
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