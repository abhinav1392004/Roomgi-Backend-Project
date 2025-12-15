const express = require("express");

const { addStaff,getStaffByid, getAllStaff, updateStaff, deleteStaff }= require ("../controller/staff");
const {Validate} = require("../middleware/uservalidate");

const router = express.Router();

router.post("/", addStaff);
router.get("/get/:id", getStaffByid);
router.get("/get",Validate, getAllStaff);
router.put("/:id", updateStaff);
router.delete("/:id", deleteStaff);

module.exports = router;
