const express = require("express");
const router = express.Router();
const { Validate } = require("../middleware/uservalidate");

const {
    getAllbranchPayments,
    createPayment,
    createExpense,
    RevenueDetails,
    makingpayment,
    verifying,
    bookingConfermation
} = require("../controller/payment");

console.log("hiidc")

router.get("/allpayment", Validate, getAllbranchPayments);
router.post("/create", Validate, createPayment);
router.post("/create-order",Validate, makingpayment);
router.post("/verify-payment",Validate, verifying);
router.post("/create/expense", Validate, createExpense);
router.get("/getdetails", Validate, RevenueDetails);

router.get("/status/:id", Validate, bookingConfermation);







module.exports = router;