const express = require("express");
const router = express.Router();
const { Validate } = require("../middleware/uservalidate");

const complaintController = require("../controller/complaints");
console.log("fhgvbdjz")
router.get("/complain/",Validate, complaintController.getAllComplaintsForManager);
router.post("/complain/create",Validate, complaintController.createComplaint);
router.get("/complain/branch/:branchId",Validate, complaintController.getAllComplaintsOfBranch);
router.patch("/complain/status/:complaintId",Validate, complaintController.changeStatusOfComplaint);
// router.put("/complain/assign", complaintController.assignComplaint);
router.get("/complain/tenant",Validate, complaintController.getTenantComplaints);
router.get("/complain/status/:status",Validate, complaintController.getComplaintsByStatus);
router.get("/complain/category/:category",Validate, complaintController.getComplaintsByCategory);

router.delete("/complain/:complaintId",Validate, complaintController.deleteComplaint);

module.exports = router;
