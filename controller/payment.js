const Payment = require("../model/payment")
const PropertyBranch = require("../model/propertyBranch")
const Expense = require("../model/expenses")
const Tenant = require("../model/tenants")
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Signup = require("../model/user")
const redisClient = require("../utils/redis");
const mongoose = require("mongoose")
const Booking = require("../model/booking")




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
      username:booking.username,
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
        const { amount, currency = "INR" } = req.body;


        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid amount is required"
            });
        }


        const options = {
            amount: Number(amount) * 100, // Razorpay requires paisa
            currency,
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1
        };



        const order = await razorpay.orders.create(options);


        if (redisClient) {
            await redisClient.del(`payment-${req.user._id}`);
        }


        return res.status(200).json({
            success: true,
            order
        });

    } catch (error) {
        console.error("makingpayment Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

exports.verifying = async (req, res) => {
  console.log("💡 Payment verification initiated");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, roomId, amount } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Incomplete payment details" });
    }

    const branch = await PropertyBranch.findOne({ "rooms._id": roomId }).session(session);
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    const room = branch.rooms.id(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    if (room.occupied >= room.capacity) {
      return res.status(400).json({ success: false, message: "Room full" });
    }

    const booking = await Booking.create(
      [{
        bookingId: razorpay_order_id,
        email: req.user.email,
        branch: branch._id,
        room: room._id,
        roomNumber: room.roomNumber,
        paymentSource: "online",
        status: "pending",
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
      }],
      { session }
    );

    // Redis invalidation (optional, already in try/catch)
    if (redisClient?.isOpen) {
      const deletePromises = [
        redisClient.del("all-pg"),
        redisClient.del(`tenant-branch-${branch._id}`),
        redisClient.del(`room-${branch._id}-${roomId}`),
      ];
      await Promise.allSettled(deletePromises);
    }

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Payment verified & tenant added successfully",
      booking: booking[0],
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Payment verification error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  } finally {
    session.endSession();
  }
};


exports.createPayment = async (req, res) => {

    try {
        const { tenantId, branch, amountpaid } = req.body;
        const foundtenant = await Tenant.findById(tenantId);
        const onedaypayment = foundtenant.rent / 30;

        const releasedays = Math.floor((amountpaid) / onedaypayment)
        const found = await PropertyBranch.findById(branch)

        if (!amountpaid || !tenantId || !branch) {
            return res.status(400).json({
                success: false,
                message: "Please enter all the filled"
            })
        }
        console.log(foundtenant.dues)
        if (amountpaid >= foundtenant.dues) {
            const extra = amountpaid - foundtenant.dues
            foundtenant.dues = 0
            foundtenant.duesdays = 0
            foundtenant.duesmonth = 0
            foundtenant.advanced = (foundtenant.advanced || 0) + extra;
            foundtenant.paymentstatus = "paid"
            foundtenant.startdues = null
            console.log("hii")
        }
        else {

            foundtenant.dues -= amountpaid
            const date = foundtenant.dues / onedaypayment
            foundtenant.advanced = 0;
            console.log(date)
            const month = Math.floor(date / 30);
            console.log(month)
            const days = Math.floor(date - month * 30);
            console.log(days)
            foundtenant.duesmonth = month;
            foundtenant.dues > 0 && foundtenant.dues < foundtenant.securitydeposit ? foundtenant.paymentstatus = "dues" : foundtenant.paymentstatus = "over-dues"

            if (days == 0 && foundtenant.dues > 0) {
                foundtenant.duesdays = 1;
            }
            else {

                foundtenant.duesdays = (days);


            }
        }

        foundtenant.lastPayment = Date.now();

        await foundtenant.save();
        console.log(foundtenant)
        const paymnet = await Payment.create({
            tenantId,
            branch,
            amountpaid,
            email: foundtenant.email,
            tilldateAdvance: foundtenant.advanced,
            tilldatedues: foundtenant.dues,
            tilldatestatus: foundtenant.paymentstatus
        })
        if (redisClient) {
            await Promise.all([
                redisClient.del(`payment-${branch}-*`),
                redisClient.del(`tenant-${tenantId}`),
                redisClient.del(`branches-${branch}-*`),
                redisClient.del(`room-${branch}-*`),
                redisClient.del("all-pg"),
            ]);
        }
        return res.status(200).json({
            success: true,
            message: "payment created successfull",
            paymnet: paymnet,
            foundtenant
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        })
    }
}






















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