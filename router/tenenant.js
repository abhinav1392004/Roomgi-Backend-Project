const express = require("express");
const router = express.Router();
const { Validate } = require("../middleware/uservalidate");

const {
  AddTenants, MarkTenantInactive, AddRentTenants,
  GetTenantById, GetTenantsByBranch, calculatePending, UpdateTenant, getAllActiveTenant,
  BookingDetails,
  GetTenantRentHistory, getAllActiveTenantByBranch, GetTenantsByBranchId, getAlltenantbyStatus
} = require("../controller/tenant");

const {DasboardBooking}=require("../controller/user/dashboardbooking")

console.log("hiidc")

router.post("/create", Validate, AddTenants);
router.put("/update/:id", UpdateTenant);
router.get("/bookings", Validate, BookingDetails);
router.get("/GetTenantByid/:id",Validate, GetTenantById)
router.get("/GetTenantsByBranchid/:id", Validate, GetTenantsByBranchId)
router.get("/getdashboard/:id",Validate, DasboardBooking);



router.get("/calculatePending/:id", calculatePending);


// router.post("/renthistory/:tenantid", GetTenantRentHistory);
//  router.get("/allactive/:branchId", getAllActiveTenantByBranch);
router.get("/allstatus/:status", Validate, getAlltenantbyStatus);
// router.get("/activetenant/:id", Validate, getAllActiveTenant);
router.post("/markinctive/:id",Validate, MarkTenantInactive)
router.post("/AddRentTenants/:tenantId", Validate, AddRentTenants)

router.get("/GetTenantsByBranch", Validate, GetTenantsByBranch)


module.exports = router;