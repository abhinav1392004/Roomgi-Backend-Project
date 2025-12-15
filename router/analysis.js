const express = require("express");
const router = express.Router();
const { Validate } = require("../middleware/uservalidate");

const {
  propertyperformancesummary,
  PaymentStatusDistribution,
  TenantActivitySummary,
  propertyComparison,
  OccupancyRateTrend,
  Tenantactivity,Insightsgetting,
  GetPaymentCollectionReport,
} = require("../controller/analysts");


router.get("/propertyperformance", Validate, propertyperformancesummary);
router.get("/insights", Validate, Insightsgetting);

router.get("/paymentstatusdistribution", Validate, PaymentStatusDistribution);

router.get("/tenantactivitysummary", Validate, TenantActivitySummary);

router.get("/propertycomparison", Validate, propertyComparison);

router.get("/occupancyratetrend", Validate, OccupancyRateTrend);

router.get("/tenantactivity", Validate, Tenantactivity);


router.get("/paymentreport", Validate, GetPaymentCollectionReport);

module.exports = router;
