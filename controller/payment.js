const Payment = require("../model/branchmanager/payment")
const PropertyBranch = require("../model/owner/propertyBranch")
const Expense = require("../model/branchmanager/expenses")
const Tenant = require("../model/branchmanager/tenants")
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Signup = require("../model/user")
const redisClient = require("../utils/redis");
const mongoose = require("mongoose")
const Booking = require("../model/user/booking")
const { paymentQueue } = require("../queue"); // <-- make sure the path is correct




// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,        // Your Razorpay Key ID
    key_secret: process.env.RAZORPAY_KEY_SECRET // Your Razorpay Key Secret
});

exports.getAllbranchPayments = async (req, res) => {
    try {
        const managerId = req.user._id;
        const cacheKey = `payment-${managerId}`;

        // 1️⃣ Check cache
        if (redisClient) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return res.status(200).json({
                    success: true,
                    message: "Payment collection report (from cache)",
                    allpayment: JSON.parse(cached),
                });
            }
        }

        // 2️⃣ Get branches
        const branches = await PropertyBranch.find({ branchmanager: managerId }).select("_id");
        if (!branches.length) {
            return res.status(404).json({ success: false, message: "No branches found" });
        }
        const branchIds = branches.map(b => b._id);

        // 3️⃣ Get payments with lean query
        const allpayment = await Payment.find({ branch: { $in: branchIds } })
            .sort({ createdAt: -1 })
            .populate("tenantId", "username email")
            .populate("branch", "name city")
            .lean(); // lean reduces memory overhead

        // 4️⃣ Save cache (1 hour)
        if (redisClient) {
            await redisClient.setEx(cacheKey, 3600, JSON.stringify(allpayment));
        }

        // 5️⃣ Response
        return res.status(200).json({
            success: true,
            message: "Payment collection report",
            allpayment,
        });

    } catch (error) {
        console.error("getAllbranchPayments Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};



exports.bookingConfermation = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch booking and populate room info
        const booking = await Booking.findById(id).populate("branch");

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        const room = booking.room;

        return res.status(200).json({
            success: true,
            bookingId: booking._id,
            status: booking.status,
            username: booking.username,
            branchName: booking?.branch?.name || null,
            roomNumber: booking?.roomNumber || null,
            amount: booking.amountPaid,
        });
    } catch (error) {
        console.error("Error fetching booking:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};



exports.makingpayment = async (req, res) => {
    try {
        console.log("💳 makingpayment called with body:", req.body);

        const { amount, currency = "INR" } = req.body;

        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            console.error("❌ Invalid amount:", amount);
            return res.status(400).json({
                success: false,
                message: "Valid amount is required"
            });
        }

        const options = {
            amount: Number(amount), // amount in paise
            currency,
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1
        };

        console.log("📦 Razorpay order options:", options);

        const order = await razorpay.orders.create(options);

        console.log("✅ Razorpay order created:", order);

        if (redisClient) {
            await redisClient.del(`payment-${req.user._id}`);
            console.log("🗑 Redis cache cleared for user:", req.user._id);
        }

        return res.status(200).json({
            success: true,
            order
        });

    } catch (error) {
        console.error("❌ makingpayment Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.verifying = async (req, res) => {
    console.log("💡 Payment verification initiated");

    const session = await mongoose.startSession();
    let committed = false;

    try {
        session.startTransaction();

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, roomId, amount } = req.body;

        console.log("📦 Received payment details:", req.body);

        // ---------- BASIC VALIDATION ----------
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            console.log("❌ Incomplete payment details");
            return res.status(400).json({ success: false, message: "Incomplete payment details" });
        }
        console.log("✅ Payment details present");

        // ---------- SIGNATURE VERIFICATION ----------
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        console.log("🔑 Generated signature:", generatedSignature);
        console.log("🔑 Received signature:", razorpay_signature);

        if (generatedSignature !== razorpay_signature) {
            console.log("❌ Invalid payment signature");
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }
        console.log("✅ Signature verified");

        // ---------- IDEMPOTENCY ----------
        console.log("🔍 Checking if payment already exists in DB...");
        const existingBooking = await Booking.findOne({ "razorpay.paymentId": razorpay_payment_id }).session(session);

        if (existingBooking) {
            console.log("⚠️ Payment already verified:", existingBooking.bookingId);
            await session.abortTransaction();
            return res.status(200).json({ success: true, message: "Payment already verified", booking: existingBooking });
        }
        console.log("✅ Payment not found in DB, proceeding");

        // ---------- BRANCH & ROOM ----------
        console.log("🏢 Fetching branch for room:", roomId);
        const branch = await PropertyBranch.findOne({ "rooms._id": roomId }).session(session);

        if (!branch) {
            console.log("❌ Branch not found for room:", roomId);
            return res.status(404).json({ success: false, message: "Branch not found" });
        }
        console.log("✅ Branch found:", branch._id);

        const room = branch.rooms.id(roomId);
        if (!room) {
            console.log("❌ Room not found:", roomId);
            return res.status(404).json({ success: false, message: "Room not found" });
        }
        console.log("✅ Room found:", room.roomNumber);

        if (room.occupied >= room.capacity) {
            console.log("❌ Room full:", room.roomNumber);
            return res.status(400).json({ success: false, message: "Room full" });
        }

        // ---------- LOCK ROOM ----------
        console.log("🔒 Locking room for booking...");
        room.occupied += 1;
        room.vacant = room.capacity - room.occupied;
        room.availabilityStatus = room.vacant === 0 ? "Occupied" : "Available";

    
        await branch.save({ session });
        console.log("✅ Room locked:", room.roomNumber, "Occupied:", room.occupied);

        // ---------- CREATE BOOKING ----------
        console.log("📌 Creating booking record...");
        const booking = await Booking.create([{
            bookingId: razorpay_order_id,
            email: req.user.email,
            branch: branch._id,
            room: room._id,
            roomNumber: room.roomNumber,
            paymentSource: "online",
            status: "processing",
            amount: {
                totalAmount: amount.totalAmount || 0,
                payableAmount: amount.payableAmount || 0,
                walletUsed: amount.walletUsed || 0,
            },
            razorpay: {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
            },
            userId: req.user._id,
            username: req.user.username,
        }], { session });
        console.log("✅ Booking created:", booking[0].bookingId);

        // ---------- REDIS INVALIDATION ----------
        console.log("♻️ Invalidating Redis cache...");
        await Promise.allSettled([
            redisClient.del("all-pg"),
            redisClient.del(`tenant-branch-${branch._id}`),
            redisClient.del(`room-${branch._id}-${roomId}`),
        ]);
        console.log("✅ Redis cache cleared");

        // ---------- PUSH TO WORKER ----------
        console.log("📤 Adding job to paymentQueue...");
        await paymentQueue.add("process-payment", {
            bookingId: booking[0].bookingId,
            razorpay_payment_id,
        });
        console.log("✅ Job added to paymentQueue");

        // ---------- COMMIT TRANSACTION ----------
        await session.commitTransaction();
        committed = true;
        console.log("✅ Transaction committed");

        return res.status(200).json({ success: true, message: "Payment verified successfully", booking: booking[0] });

    } catch (error) {
        if (!committed) {
            await session.abortTransaction();
            console.log("⚠️ Transaction aborted due to error");
        }
        console.error("❌ Payment verification error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal server error" });
    } finally {
        session.endSession();
        console.log("🛑 Session ended");
    }
};



////////////////////////////////////////////////////


exports.createExpense = async (req, res) => {

    try {


        const { category, amount, branchId } = req.body;

        if (!category || !amount || !branchId) {
            return res.status(400).json({
                success: false,
                message: "please Fill all the details"
            })
        }


        const expensecreate = await Expense.create({
            category,
            amount,
            branchId
        })
        return res.status(200).json({
            success: true,
            message: "expense created",
            expenses: expensecreate
        })


    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        })

    }
}

exports.getAllExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find().populate("branchId"); // populate branch info if needed

        return res.status(200).json({
            success: true,
            message: "All expenses fetched successfully",
            allExpense: expenses,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};



exports.RevenueDetails = async (req, res) => {
    try {
        const { month, year } = req.query;
        const userId = req.user._id;
        let notPaid = [];

        // Fetch all branches for this branch manager
        const branches = await PropertyBranch.find({ branchmanager: userId });

        if (!branches.length) {
            return res.status(400).json({
                success: false,
                message: "No branches found for this owner",
            });
        }

        // Date range for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        let allPayments = [];
        let allExpenses = [];
        let tenantPayments = {}; // key: tenantId, value: { tenant, totalAdvance }
        let totalExpense = 0;
        let totalIncome = 0;

        for (const branch of branches) {
            // Fetch expenses
            const branchExpenses = await Expense.find({
                branchId: branch._id,
                createdAt: { $gte: startDate, $lte: endDate },
            }).populate("branchId");

            branchExpenses.forEach((exp) => {
                totalExpense += exp.amount || 0;
            });

            allExpenses.push(...branchExpenses);

            // Fetch payments
            const branchPayments = await Payment.find({
                branch: branch._id,
                createdAt: { $gte: startDate, $lte: endDate },
            })
                .sort({ createdAt: -1 })
                .populate("tenantId")
                .populate("branch");

            allPayments.push(...branchPayments);

            // Process tenant payments safely
            branchPayments.forEach((payment) => {
                const tenant = payment.tenantId;
                if (!tenant) return; // skip null tenants

                const tenantId = tenant._id.toString();
                const tenantRent = tenant.rent || 0;

                if (!tenantPayments[tenantId]) {
                    tenantPayments[tenantId] = {
                        tenant: tenant,
                        totalAdvance: payment.tilldateAdvance || 0,
                    };
                } else {
                    tenantPayments[tenantId].totalAdvance = Math.max(
                        tenantPayments[tenantId].totalAdvance,
                        payment.amountpaid || 0
                    );
                }

                tenantPayments[tenantId].totalAdvance -= tenantRent;

                // Sum income safely
                totalIncome += payment.amountpaid || 0;
            });

            // Identify tenants who haven't paid
            const allTenants = await Tenant.find({ branch: branch._id });
            const paidTenantIds = branchPayments
                .filter((p) => p.tenantId)
                .map((p) => p.tenantId._id.toString());

            allTenants.forEach((tenant) => {
                if (!paidTenantIds.includes(tenant._id.toString())) {
                    notPaid.push(tenant);
                }
            });
        }

        const totalRevenue = totalIncome - totalExpense;

        return res.status(200).json({
            success: true,
            message: `Payment collection report for ${month}-${year}`,
            allPayments,
            allExpenses,
            expense: totalExpense,
            income: totalIncome,
            totalRevenue,
            notPaid,
            tenantPayments,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};