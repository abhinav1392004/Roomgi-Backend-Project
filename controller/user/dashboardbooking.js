
const Payment = require("../../model/payment")
const PropertyBranch = require("../../model/owner/propertyBranch")
const Tenant = require("../../model/branchmanager/tenants")

const mongoose = require("mongoose");












exports.DasboardBooking = async (req, res) => {
  try {
    console.log("===== DASHBOARD API HIT =====");

    const userId = req.user._id; // logged-in user
    const roomId = req.params.id; // room _id from params

    console.log("User ID:", userId);
    console.log("Room ID from params:", roomId);

    /* ================= FIND TENANT ================= */
    console.log("Finding tenant...");
    const tenant = await Tenant.findOne({ tenantId: userId })
      .populate("branch", "name city address");

    console.log("Tenant found:", tenant);

    if (!tenant) {
      console.log("❌ Tenant not found");
      return res.status(404).json({
        success: false,
        message: "Tenant not found"
      });
    }


    /* ================= FIND BRANCH ================= */
    console.log("Finding branch with ID:", tenant.branch);
    const branch = await PropertyBranch.findOne({
      _id: tenant.branch,
      "rooms.roomNumber":tenant.roomNumber
    });

    console.log("Branch found:", branch);

    if (!branch) {
      console.log("❌ Branch not found");
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    /* ================= FIND ROOM ================= */
    console.log("Finding room inside branch...");
    const room = branch.rooms.id(branch.rooms[0]);

    console.log("Room found:", room);

    if (!room) {
      console.log("❌ Room not found in branch");
    }

    /* ================= PAYMENT HISTORY ================= */
    console.log("Fetching payment history...");
    const payments = await Payment.find({
      email: req.user.email,
      status:"paid"
    }).sort({ createdAt: -1 });

    console.log("Payments found:", payments);

    /* ================= FINANCE CALCULATION ================= */
    console.log("Calculating total paid amount...");
    const totalPaid = payments.reduce(
      (sum, p) => {
        console.log("Adding payment amount:", p.amountpaid);
        return sum + (p.amountpaid || 0);
      },
      0
    );

    console.log("Total paid calculated:", totalPaid);

    /* ================= RESPONSE BUILD ================= */
    console.log("Building response object...");

    const response = {
      tenant: {
        id: tenant._id,
        name: tenant.name,
        email: tenant.email,
        roomNumber: tenant.roomNumber,
        status: tenant.status,
        checkInDate: tenant.checkInDate
      },

      branch: {
        name: branch.name,
        city: branch.city,
        address: branch.address
      },

      room: {
        roomNumber: room.roomNumber,
        capacity:room.capacity,
        facilities:room.facilities,
        category: room.category,
        price: tenant.rent,
        advancedmonth: room.advancedmonth,
        services: room.services || []
      },

      finance: {
        monthlyRent: tenant.rent,
        advancePaid: tenant.advanced,
        securityDeposit: tenant.securityDeposit,
        totalPaid,
        totalDues: tenant.duesamount,
        paymentStatus: tenant.paymentStatus,
        duesMonth: tenant.duesmonth,
        duesDays: tenant.duesdays,
        nextPaymentDate: tenant.startDuesFrom
      },

      payments: payments.map(p => {
        console.log("Mapping payment:", p._id);
        return {
          id: p._id,
          month: p.paymentInMonth,
          amount: p.amountpaid,
          mode: p.mode,
          status: p.status,
          date: p.createdAt
        };
      })
    };

    console.log("✅ FINAL RESPONSE:", response);

    return res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error("🔥 DASHBOARD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
