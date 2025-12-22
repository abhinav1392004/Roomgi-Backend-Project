exports.getAlltenantbyStatus = async (req, res) => {
  try {
    const managerEmail = req.user.email;
    const { status } = req.params;

    // ✅ Validate status
    const allowedStatus = ["Active", "Inactive", "Vacated", "all"];
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tenant status",
      });
    }

    // ✅ Cache key (status-specific)
    const cacheKey = `tenant-${managerEmail}-${status}`;

    // ✅ Check Redis cache
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: "Tenants fetched from cache",
        tenants: JSON.parse(cachedData),
      });
    }

    // ✅ Fetch all branches managed by this manager
    const branches = await branchmanager.find(
      { email: req.user.email },
      { _id: 1 }
    );
  const branch=await PropertyBranch.findOne({branchmanager:branches[0]._id})
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "No branches found for this manager",
      });
    }

    // ✅ Fetch tenants by status
    const query =
      status === "all"
        ? { branch: branch._id } 
        : { branch: branch._id , status };

    const tenants = await Tenant.find(query)
      .sort({ createdAt: -1 });

    // ✅ Cache for 1 hour
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(tenants));

    return res.status(200).json({
      success: true,
      message: "Tenants fetched successfully",
      count: tenants.length,
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