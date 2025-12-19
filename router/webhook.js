const express = require("express");

const { paymentWebhook } =require("../controller/webhook") 

const router = express.Router();


router.post(
  "/webhooks",
  express.raw({ type: "application/json" }),
  paymentWebhook
);


module.exports = router;
