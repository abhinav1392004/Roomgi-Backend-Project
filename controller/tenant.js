

const Tenant = require("../model/tenants")
const Payment = require("../model/payment")
const PropertyBranch = require("../model/propertyBranch")
const Complaint = require("../model/complaints")
const redisClient = require("../utils/redis");







const { validationResult, body } = require("express-validator");


// ---------------------------
// Middleware: Validate Tenant Input
// ---------------------------
exports.validateAddTenant = [
    body("contactNumber").isMobilePhone().withMessage("Invalid contact number"),
    body("name").notEmpty().withMessage("Name is required"),
    body("Rent").isNumeric().withMessage("Rent must be a number"),
    body("roomNumber").isNumeric().withMessage("Room number must be a number"),
    body("branch").notEmpty().withMessage("Branch ID is required"),
];

// ---------------------------
// Add Tenant
// ---------------------------
exports.AddTenants = async (req, res) => {
    try {
        // ✅ Validation check
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const {
            contactNumber,
            name,
            Rent,
            dues = 0,
            advanced = 0,
            idProof,
            idProofType,
            emergencyContactNumber,
            documentsPhoto,
            roomNumber,
            branch
        } = req.body;

        // 🔹 Find branch
        const FoundBranch = await PropertyBranch.findById(branch);
        if (!FoundBranch) return res.status(404).json({ success: false, message: "Branch not found" });

        // 🔹 Find room
        const roomNum = Number(roomNumber);
        const room = FoundBranch.rooms.find(r => Number(r.roomNumber) === roomNum);
        if (!room) return res.status(404).json({ success: false, message: "Room not found" });
        if (!room.verified) return res.status(400).json({ success: false, message: "Room is not verified" });

        // 🔹 Room capacity check
        const capacity = room.type === "Double" ? 2 : room.type === "Triple" ? 3 : 1;
        const tenantsInRoom = await Tenant.countDocuments({ branch, roomNumber: roomNum, status: "Active" });
        if (tenantsInRoom >= capacity) {
            return res.status(400).json({ success: false, message: "Room already full" });
        }

        // 🔹 Create tenant
        const NewTenant = await Tenant.create({
            branch,
            contactNumber,
            name,
            rent: Rent,
            dues,
            mode: "offline",
            advanced,
            idProof,
            idProofType,
            emergencyContactNumber,
            documentsPhoto,
            roomNumber: roomNum,
            branchmanager: req.user._id,
            status: "Active",
            checkInDate: new Date()
        });

        // 🔹 Update room stats
        room.occupied += 1;
        room.vacant = Math.max(0, capacity - room.occupied);
        if (room.occupied >= capacity) room.availabilityStatus = "Occupied";
        if (!FoundBranch.occupiedRoom.includes(roomNum)) FoundBranch.occupiedRoom.push(roomNum);
        FoundBranch.totalBeds = Math.max(0, FoundBranch.totalBeds - 1);

        await FoundBranch.save();

        // 🔹 Clear Redis cache
        if (redisClient) {
            const keys = await redisClient.keys("tenant-*");
            if (keys.length) await redisClient.del(keys);
            const branchKeys = await redisClient.keys("branches-*");
            if (branchKeys.length) await redisClient.del(branchKeys);
            const roomKeys = await redisClient.keys("room-*");
            if (roomKeys.length) await redisClient.del(roomKeys);
            await redisClient.del("all-pg");
        }

        return res.status(201).json({ success: true, message: "Tenant added successfully", tenant: NewTenant });

    } catch (error) {
        console.error("AddTenants Error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ---------------------------
// Mark Tenant Inactive (Checkout)
// ---------------------------
exports.MarkTenantInactive = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ success: false, message: "Tenant ID is required" });

        const tenant = await Tenant.findById(id);
        if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

        const branch = await PropertyBranch.findById(tenant.branch);
        if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

        const room = branch.rooms.find(r => Number(r.roomNumber) === Number(tenant.roomNumber));
        if (!room) return res.status(404).json({ success: false, message: "Room not found" });

        const capacity = room.type === "Double" ? 2 : room.type === "Triple" ? 3 : 1;

        // 🔹 Calculate dues
        const payments = await Payment.find({ tenantId: tenant._id });
        let totalPaid = tenant.advanced || 0;
        payments.forEach(p => totalPaid += p.amountpaid);
        const checkIn = new Date(tenant.checkInDate);
        const checkOut = new Date();
        const totalMonths = (checkOut.getFullYear() - checkIn.getFullYear()) * 12 + (checkOut.getMonth() - checkIn.getMonth()) + 1;
        const totalShouldPay = totalMonths * tenant.rent;

        if (tenant.dues > 0 || totalPaid < totalShouldPay) {
            return res.status(400).json({
                success: false,
                message: `Clear dues before checkout. Pending: ₹${totalShouldPay - totalPaid}`
            });
        }

        // 🔹 Checkout
        tenant.status = "In-Active";
        tenant.checkedoutdate = checkOut;

        room.occupied = Math.max(0, room.occupied - 1);
        room.vacant = capacity - room.occupied;
        room.availabilityStatus = room.occupied >= capacity ? "Occupied" : "Available";

        if (room.occupied === 0) branch.occupiedRoom = branch.occupiedRoom.filter(rn => Number(rn) !== Number(room.roomNumber));
        branch.totalBeds += 1;

        await tenant.save();
        await branch.save();

        // 🔹 Clear Redis cache
        if (redisClient) {
            const keys = await redisClient.keys("tenant-*");
            if (keys.length) await redisClient.del(keys);
            const branchKeys = await redisClient.keys("branches-*");
            if (branchKeys.length) await redisClient.del(branchKeys);
            const roomKeys = await redisClient.keys("room-*");
            if (roomKeys.length) await redisClient.del(roomKeys);
            await redisClient.del("all-pg");
        }

        return res.status(200).json({ success: true, message: "Tenant checked out successfully", tenant });

    } catch (error) {
        console.error("MarkTenantInactive Error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};




















// ------------------------------
// Update Tenant
// ------------------------------
exports.UpdateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const foundTenant = await Tenant.findById(id);
        if (!foundTenant) return res.status(404).json({ success: false, message: "Tenant not found" });

        Object.keys(updates).forEach(key => foundTenant[key] = updates[key]);
        await foundTenant.save();

        // ------------------------------
        // Clear related Redis caches
        // ------------------------------
        if (redisClient) {
            const tenantKeys = await redisClient.keys(`tenant-*`);
            if (tenantKeys.length) await redisClient.del(tenantKeys);

            const branchKeys = await redisClient.keys(`branches-*`);
            if (branchKeys.length) await redisClient.del(branchKeys);

            const roomKeys = await redisClient.keys(`room-*`);
            if (roomKeys.length) await redisClient.del(roomKeys);

            await redisClient.del("all-pg");
        }

        return res.status(200).json({ success: true, message: "Tenant updated successfully", tenant: foundTenant });

    } catch (error) {
        console.error("UpdateTenant Error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// ------------------------------
// Get Tenant By ID
// ------------------------------
exports.GetTenantById = async (req, res) => {
    try {
        const { id } = req.params;
        const cachedKey = `tenant-${req.user._id}-byid-${id}`;

        // 1️⃣ Check Redis cache first
        const cachedData = await redisClient.get(cachedKey);
        if (cachedData) {
            return res.status(200).json({ success: true, message: "Tenant fetched from cache", ...JSON.parse(cachedData) });
        }

        // 2️⃣ Fetch from DB
        const foundTenant = await Tenant.findById(id)
            .populate({ path: "branch", populate: { path: "property" } });

        if (!foundTenant) return res.status(404).json({ success: false, message: "Tenant not found" });

        const allComplaints = await Complaint.find({ tenantId: id });
        const allPayments = await Payment.find({ tenantId: id });

        const responseData = { foundTenant, allComplaints, allPayments };

        // 3️⃣ Cache in Redis for 1 hour
        await redisClient.set(cachedKey, JSON.stringify(responseData), { EX: 3600 });

        return res.status(200).json({ success: true, message: "Tenant fetched successfully", ...responseData });

    } catch (error) {
        console.error("GetTenantById Error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ------------------------------
// Add Rent Payment for Tenant
// ------------------------------
exports.AddRentTenants = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { amountPaid } = req.body;

        if (!amountPaid || amountPaid <= 0) return res.status(400).json({ success: false, message: "Invalid payment amount" });

        const tenant = await Tenant.findById(tenantId);
        if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

        const payment = await Payment.create({ tenantId, amountpaid: amountPaid, branch: tenant.branch });
        tenant.dues = Math.max(0, tenant.dues - amountPaid);
        await tenant.save();

        // Clear cache
        if (redisClient) {
            const tenantKeys = await redisClient.keys(`tenant-*`);
            if (tenantKeys.length) await redisClient.del(tenantKeys);
        }

        return res.status(200).json({ success: true, message: "Payment recorded successfully", tenant });

    } catch (error) {
        console.error("AddRentTenants Error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ------------------------------
// Get All Tenants By Branch
// ------------------------------
exports.GetTenantsByBranchId = async (req, res) => {
    try {
        const { id } = req.params;
        const cachedKey = `tenant-branch-${id}`;

        const cachedData = await redisClient.get(cachedKey);
        if (cachedData) return res.status(200).json({ success: true, message: "Tenants fetched from cache", tenants: JSON.parse(cachedData) });

        const tenants = await Tenant.find({ branch: id });
        await redisClient.set(cachedKey, JSON.stringify(tenants), { EX: 3600 });

        return res.status(200).json({ success: true, message: "All tenants fetched successfully", tenants });

    } catch (error) {
        console.error("GetTenantsByBranchId Error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};


///////////////////////////////////////////////////////

































// ------------------------------
// Get All Tenants for a Branch Manager
// ------------------------------
exports.GetTenantsByBranch = async (req, res) => {
    try {
        const branchManagerId = req.user._id;
        const cachedKey = `tenant-branchManager-${branchManagerId}`;

        // 1️⃣ Check Redis cache first
        const cachedData = await redisClient.get(cachedKey);
        if (cachedData) {
            return res.status(200).json({
                success: true,
                message: "Tenant details fetched from cache",
                tenants: JSON.parse(cachedData),
            });
        }

        // 2️⃣ Get all branches for this branch manager
        const branches = await PropertyBranch.find({ branchmanager: branchManagerId }).select("_id");
        if (!branches.length) {
            return res.status(200).json({
                success: true,
                message: "No properties found for this branch manager",
                tenants: [],
            });
        }

        // 3️⃣ Fetch all tenants in one query
        const branchIds = branches.map(branch => branch._id);
        const tenants = await Tenant.find({ branch: { $in: branchIds } });

        // 4️⃣ Cache result in Redis (1 hour)
        await redisClient.set(cachedKey, JSON.stringify(tenants), { EX: 3600 });

        return res.status(200).json({
            success: true,
            message: "All tenants fetched successfully",
            tenants: tenants,
        });

    } catch (error) {
        console.error("GetTenantsByBranch Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// ------------------------------
// Calculate Pending Dues for a Tenant
// ------------------------------
exports.calculatePending = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate tenant
        const tenant = await Tenant.findById(id);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: "Tenant not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Tenant pending dues fetched successfully",
            dues: tenant.dues || 0,
        });

    } catch (error) {
        console.error("calculatePending Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};








// ---------------------------
// Get Booking Details of Current Tenant
// ---------------------------
exports.BookingDetails = async (req, res) => {
    try {
        const cacheKey = `tenant-${req.user._id}-booking`;

        // Check if cached
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            return res.status(200).json({
                success: true,
                message: "All bookings fetched from cache",
                bookings: JSON.parse(cached),
            });
        }

        // Fetch all bookings for this tenant
        const allBookings = await Tenant.find({ name: req.user.username });

        if (!allBookings.length) {
            return res.status(404).json({
                success: false,
                message: "No bookings found for this tenant",
            });
        }

        const bookingsWithRoomInfo = await Promise.all(
            allBookings.map(async (booking) => {

                const branch = await PropertyBranch.findOne(
                    { "rooms.roomNumber": booking.roomNumber },
                    { name: 1, city: 1, "rooms.$": 1 }
                ).populate({
                    path: "rooms.personalreview",
                    populate: {
                        path: "user",
                        select: "username email _id"
                    }
                });

                if (!branch || !branch.rooms?.length) {
                    return {
                        ...booking.toObject(),
                        branch: null,
                        room: null,
                        roomImages: [],
                        reviews: [],
                    };
                }

                const room = branch.rooms[0];

                return {
                    ...booking.toObject(),
                    branch: {
                        _id: branch._id,
                        name: branch.name,
                        city: branch.city,
                    },
                    room,
                    roomImages: room.roomImages || [],
                    reviews: room.personalreview || [],
                };
            })
        );



        // Cache the data for 10 minutes
        await redisClient.setEx(cacheKey, 600, JSON.stringify(bookingsWithRoomInfo));

        return res.status(200).json({
            success: true,
            message: "All bookings fetched successfully",
            bookings: bookingsWithRoomInfo,
        });

    } catch (error) {
        console.error("BookingDetails Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// ---------------------------
// Get Rent History of a Tenant
// ---------------------------
exports.GetTenantRentHistory = async (req, res) => {
    try {
        const { tenantid } = req.params;

        if (!tenantid) {
            return res.status(400).json({
                success: false,
                message: "Tenant ID is required",
            });
        }

        const tenant = await Tenant.findById(tenantid)
            .populate({ path: 'branch', select: 'name' });

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: "Tenant not found",
            });
        }

        const payments = await Payment.find({ tenantId: tenantid }).sort({ date: 1 });

        return res.status(200).json({
            success: true,
            message: "Tenant rent history fetched successfully",
            tenant,
            payments,
        });
    } catch (error) {
        console.error("GetTenantRentHistory Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// ---------------------------
// Get All Tenants by Status (Branch Manager)
// ---------------------------
exports.getAlltenantbyStatus = async (req, res) => {
    try {
        const managerId = req.user._id;
        const { status } = req.params;

        const cachedKey = `tenant-${managerId}-status-${status}`;
        const cachedData = await redisClient.get(cachedKey);
        if (cachedData) {
            return res.status(200).json({
                success: true,
                message: "Tenants fetched from cache",
                tenants: JSON.parse(cachedData),
            });
        }

        const branches = await PropertyBranch.find({ branchmanager: managerId }).select('_id');
        if (!branches.length) {
            return res.status(404).json({
                success: false,
                message: "No branches found for this manager",
            });
        }

        const branchIds = branches.map(b => b._id);
        const tenants = status === "all"
            ? await Tenant.find({ branch: { $in: branchIds } })
            : await Tenant.find({ branch: { $in: branchIds }, status });

        await redisClient.setEx(cachedKey, 3600, JSON.stringify(tenants));

        return res.status(200).json({
            success: true,
            message: "Tenants fetched successfully",
            tenants,
        });
    } catch (error) {
        console.error("getAlltenantbyStatus Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// ---------------------------
// Get All Active Tenants for a Branch
// ---------------------------
exports.getAllActiveTenant = async (req, res) => {
    try {
        const { id: branchId } = req.params;
        if (!branchId) {
            return res.status(400).json({ success: false, message: "Branch ID required" });
        }

        const cachedKey = `tenant-${branchId}-active`;
        const cachedData = await redisClient.get(cachedKey);
        if (cachedData) {
            return res.status(200).json({
                success: true,
                message: "Active tenants from cache",
                tenants: JSON.parse(cachedData),
            });
        }

        const tenants = await Tenant.find({ branch: branchId, status: { $ne: "In-Active" } });
        await redisClient.setEx(cachedKey, 3600, JSON.stringify(tenants));

        return res.status(200).json({
            success: true,
            message: "Active tenants fetched successfully",
            tenants,
        });
    } catch (error) {
        console.error("getAllActiveTenant Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// ---------------------------
// Get Tenants by Status for a Branch
// ---------------------------
exports.getAllStatusTenantByBranch = async (req, res) => {
    try {
        const { branchId } = req.params;
        const { status } = req.body;

        if (!branchId || !status) {
            return res.status(400).json({ success: false, message: "Branch ID and status are required" });
        }

        const tenants = await Tenant.find({ branch: branchId, status });
        if (!tenants.length) {
            return res.status(404).json({ success: false, message: "No tenants found" });
        }

        const activeTenants = tenants
            .filter(t => t.status === "Active")
            .map(t => ({
                name: t.name,
                contact: t.contactNumber,
                rent: t.rent,
                checkInDate: t.checkInDate,
            }));

        return res.status(200).json({
            success: true,
            message: "Active tenants fetched successfully",
            activeTenants,
        });
    } catch (error) {
        console.error("getAllStatusTenantByBranch Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};



