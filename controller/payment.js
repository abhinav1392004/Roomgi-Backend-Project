const Payment = require("../model/payment")
const PropertyBranch = require("../model/propertyBranch")
const Expense = require("../model/expenses")
const Tenant = require("../model/tenants")
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Signup = require("../model/user")
const redisClient = require("../utils/redis");
const mongoose = require("mongoose")

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.razorpay_payment_id,        // Your Razorpay Key ID
    key_secret: process.env.RZP_KEY_SECRET // Your Razorpay Key Secret
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




exports.makingpayment = async (req, res) => {
    try {
        const { amount, currency = "INR", receipt } = req.body;

        // 1️⃣ Validate amount
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid amount is required"
            });
        }

        // 2️⃣ Prepare Razorpay order options
        const options = {
            amount: Number(amount), // Razorpay expects amount in paise
            currency,
            receipt: receipt || `receipt_${Date.now()}`,
            payment_capture: 1
        };

        // 3️⃣ Create order
        const order = await razorpay.orders.create(options);

        // 4️⃣ Clear payment cache for this manager
        if (redisClient) {
            await redisClient.del(`payment-${req.user._id}`);
        }

        // 5️⃣ Send response
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




// exports.verifying = async (req, res) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const { razorpay_order_id, razorpay_payment_id, razorpay_signature, roomId, amount } = req.body;

//         // 1️⃣ Fetch user
//         const user = await Signup.findById(req.user._id).session(session);
//         if (!user) return res.status(400).json({ success: false, message: "User not found" });

//         // 2️⃣ Fetch branch and room
//         const branchDoc = await PropertyBranch.findOne({ "rooms._id": roomId }).session(session);
//         if (!branchDoc) return res.status(400).json({ success: false, message: "Branch not found" });

//         const room = branchDoc.rooms.id(roomId);
//         if (!room) return res.status(400).json({ success: false, message: "Room not found" });

//         // 3️⃣ Verify payment signature
//         if (razorpay_payment_id && razorpay_signature) {
//             const generated_signature = crypto
//                 .createHmac("sha256", process.env.RZP_KEY_SECRET)
//                 .update(razorpay_order_id + "|" + razorpay_payment_id)
//                 .digest("hex");

//             if (generated_signature !== razorpay_signature) {
//                 return res.status(400).json({ success: false, message: "Invalid signature" });
//             }
//         } else if (razorpay_payment_id) {
//             const payment = await rzp.payments.fetch(razorpay_payment_id);
//             if (payment.status !== "captured") {
//                 return res.status(400).json({ success: false, message: "Payment not completed yet" });
//             }
//         } else {
//             return res.status(400).json({ success: false, message: "Payment not completed yet" });
//         }

//         // 4️⃣ Determine rent and capacity
//         const name = user.username;
//         const roomNumber = room.roomNumber;
//         const Rent = room.price || room.rentperday || room.rentperNight || room.rentperhour;
//         const branchId = room.branch;

//         let capacity = 1;
//         if (room.category === "Pg") {
//             capacity = room.type === "Double" ? 2 : room.type === "Triple" ? 3 : 1;
//         }

//         // 5️⃣ Atomic room update & tenant creation
//         if (room.occupied >= capacity) {
//             return res.status(400).json({ success: false, message: "Room full" });
//         }
//         if (!room.verified) return res.status(400).json({ success: false, message: "Room not verified" });

//         const newTenant = await Tenant.create(
//             [
//                 {
//                     branch: branchId,
//                     name,
//                     Rent,
//                     dues: 0,
//                     advanced: 0,
//                     roomNumber,
//                 },
//             ],
//             { session }
//         );


//         room.occupied += 1;
//         room.vacant = Math.max(0, capacity - room.occupied);
//         room.availabilityStatus = room.occupied >= capacity ? "Occupied" : "Available";

//         branchDoc.markModified("rooms");
//         await branchDoc.save({ session });

//         // 6️⃣ Payment creation
//         await Payment.create(
//             [
//                 {
//                     tenantId: req.user._id,
//                     branch: branchId,
//                     mode: "Online",
//                     tilldatestatus: "paid",
//                     amountpaid: amount,
//                     razorpay_order_id,
//                     razorpay_payment_id,
//                     razorpay_signature,
//                 },
//             ],
//             { session }
//         );

//         // 7️⃣ Commit transaction
//         await session.commitTransaction();
//         session.endSession();


//         const branch =await PropertyBranch.findById(branchId);



//         // 8️⃣ Targeted Redis invalidation
//         if (redisClient) {
//             const branchKeys = [`payment-${branch.branchmanager}`, `tenant-${branchId}`, `room-${branchId}-${roomId}`];
//             for (const key of branchKeys) {
//                 await redisClient.del(key);
//             }
//         }

//         // 9️⃣ Response
//         return res.status(200).json({
//             success: true,
//             message: "Tenant added + Payment verified successfully",
//             tenant: newTenant[0],
//             branch: branchDoc,
//         });
//     } catch (error) {
//         await session.abortTransaction();
//         session.endSession();
//         console.error("❌ Error verifying payment:", error);
//         return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
//     }
// };


exports.verifying = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            roomId,
            amount,
        } = req.body;

        /* ------------------ BASIC VALIDATION ------------------ */
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Incomplete payment details",
            });
        }

        /* ------------------ USER ------------------ */
        const user = await Signup.findById(req.user._id).session(session);
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        /* ------------------ IDEMPOTENCY CHECK ------------------ */
        const existingPayment = await Payment.findOne({
            razorpay_payment_id,
        }).session(session);

        if (existingPayment) {
            await session.commitTransaction();
            session.endSession();
            return res.status(200).json({
                success: true,
                message: "Payment already processed",
            });
        }

        /* ------------------ SIGNATURE VERIFICATION ------------------ */
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RZP_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature",
            });
        }

        /* ------------------ FETCH BRANCH + ROOM ------------------ */
        const branchDoc = await PropertyBranch.findOne({
            "rooms._id": roomId,
        }).session(session);

        if (!branchDoc) {
            return res.status(400).json({ success: false, message: "Branch not found" });
        }

        const room = branchDoc.rooms.id(roomId);
        if (!room) {
            return res.status(400).json({ success: false, message: "Room not found" });
        }

        if (!room.verified) {
            return res.status(400).json({ success: false, message: "Room not verified" });
        }

        /* ------------------ CAPACITY LOGIC ------------------ */
        let capacity = 1;
        if (room.category === "Pg") {
            capacity =
                room.type === "Double" ? 2 : room.type === "Triple" ? 3 : 1;
        }

        /* ------------------ ATOMIC ROOM UPDATE ------------------ */
        const updatedBranch = await PropertyBranch.findOneAndUpdate(
            {
                _id: branchDoc._id,
                "rooms._id": roomId,
                "rooms.occupied": { $lt: capacity },
            },
            {
                $inc: { "rooms.$.occupied": 1 },
            },
            { session, new: true }
        );

        if (!updatedBranch) {
            return res.status(400).json({
                success: false,
                message: "Room is already full",
            });
        }

        const updatedRoom = updatedBranch.rooms.id(roomId);

        updatedRoom.vacant = Math.max(0, capacity - updatedRoom.occupied);
        updatedRoom.availabilityStatus =
            updatedRoom.occupied >= capacity ? "Occupied" : "Available";

        updatedBranch.markModified("rooms");
        await updatedBranch.save({ session });

        /* ------------------ TENANT CREATION ------------------ */
        const Rent =
            room.rent ||
            room.rentperday ||
            room.rentperNight ||
            room.rentperhour;

        const newTenant = await Tenant.create(
            [
                {
                    branch: room.branch,
                    name: user.username,
                    Rent,
                    tenantId:req.user._id,
                    dues: 0,
                    advanced: 0,
                    roomNumber: room.roomNumber,
                },
            ],
            { session }
        );

        /* ------------------ PAYMENT RECORD ------------------ */
        await Payment.create(
            [
                {
                    tenantId: newTenant[0]._id,
                    userId: user._id,
                    branch: room.branch,
                    mode: "Online",
                    tilldatestatus: "paid",
                    amountpaid: amount,
                    razorpay_order_id,
                    razorpay_payment_id,
                    razorpay_signature,
                },
            ],
            { session }
        );

        /* ------------------ COMMIT ------------------ */
        await session.commitTransaction();
        session.endSession();

        /* ------------------ REDIS CACHE INVALIDATION ------------------ */
        if (redisClient) {
            await Promise.all([
                redisClient.del("all-pg"),
                redisClient.del(`tenant-${room.branch}`),
                redisClient.del(`room-${room.branch}-${roomId}`),
                redisClient.del(`payment-${branchDoc.branchmanager}`),
                redisClient.del(`tenant-${req.user._id}-booking`),
            ]);
        }

        /* ------------------ RESPONSE ------------------ */
        return res.status(200).json({
            success: true,
            message: "Payment verified & tenant added successfully",
            tenant: newTenant[0],
            room: updatedRoom,
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("❌ Payment verification error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
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
