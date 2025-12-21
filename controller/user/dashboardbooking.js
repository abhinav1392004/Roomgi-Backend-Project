
const Payment = require("../../model/payment")
const PropertyBranch = require("../../model/owner/propertyBranch")
const Tenant = require("../../model/branchmanager/tenants")

const mongoose = require("mongoose");









exports.DasboardBooking = async (req, res) => {
  try {
    const userId = req.user._id;

    /* ---------------- TENANT ---------------- */
    const tenant = await Tenant.findOne({ tenantId: userId })
      .select(
        "name email roomNumber status checkInDate startDuesFrom rent advanced securityDeposit duesamount paymentStatus duesmonth duesdays branch"
      )
      .populate("branch", "name city address");

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    /* ---------------- BRANCH + ROOM ---------------- */
    const branch = await PropertyBranch.findOne({
      _id: tenant.branch,
      "rooms.roomNumber": tenant.roomNumber,
    }).select("name city address rooms");

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const room = branch.rooms.find(
      (r) => r.roomNumber === tenant.roomNumber
    );

    /* ---------------- PAYMENTS ---------------- */
    const payments = await Payment.find({
      email: tenant.email,
      status: "paid",
    })
      .sort({ createdAt: -1 });

    const totalPaid = payments.reduce(
      (sum, p) => sum + (p.amountpaid || 0),
      0
    );

    /* ---------------- RESPONSE ---------------- */
    const response = {
      tenant: {
        id: tenant._id,
        name: tenant.name,
        email: tenant.email,
        roomNumber: tenant.roomNumber,
        status: tenant.status,
        checkInDate: tenant.checkInDate,
        startDuesFrom: tenant.startDuesFrom,
      },

      branch: {
        name: branch.name,
        city: branch.city,
        address: branch.address,
      },

      room: {
        roomNumber: room.roomNumber,
        capacity: room.capacity,
        facilities: room.facilities,
        category: room.category,
        price: tenant.rent,
        advancedmonth: room.advancedmonth,
        services: room.services || [],
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
        nextPaymentDate: tenant.startDuesFrom,
      },

      payments,
    };

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("🔥 DASHBOARD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
