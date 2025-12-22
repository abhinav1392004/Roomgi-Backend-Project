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
        const branches = await branchmanager.findOne({email:req.user.email} )
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


exports.GetTenantsByBranchId = async (req, res) => {
    try {
        const { id } = req.params;
        const cachedKey = `tenant-branch-${id}`;

        const cachedData = await redisClient.get(cachedKey);
        if (cachedData) return res.status(200).json({ success: true, message: "Tenants fetched from cacheerercv", tenants: JSON.parse(cachedData) });

        const tenants = await Tenant.find({ branch: id });
        await redisClient.set(cachedKey, JSON.stringify(tenants), { EX: 3600 });

        return res.status(200).json({ success: true, message: "All tenants fetched successfully", tenants });

    } catch (error) {
        console.error("GetTenantsByBranchId Error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

