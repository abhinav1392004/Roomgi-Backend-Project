const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieparser = require("cookie-parser");

// Routers
const userRouter = require("./router/user");
const propertyRouter = require("./router/property");
const tenantRouter = require("./router/tenenant");
const complainRouter = require("./router/complain");
const analyticsRouter = require("./router/analysis");
const staffRouter = require("./router/staff");
const paymentRouter = require("./router/payment");
const reviewRouter = require("./router/review");
const webhookRouter = require("./router/webhook");

dotenv.config();

const app = express();

/* =======================
   🔥 RAZORPAY WEBHOOK (RAW)
======================= */
app.post(
  "/api/payment",
  express.raw({ type: "application/json" }),
  webhookRouter
);

/* =======================
   NORMAL MIDDLEWARES
======================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieparser());
require("./cron/refund")
require("./cron/dailyrentcalculate")

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://admin-frontend-pgmega.vercel.app",
      "https://roomgi.com",
      "https://www.roomgi.com",
    ],
    credentials: true,
  })
);

/* =======================
   ROUTES
======================= */
app.use("/api/v1/user", userRouter);
app.use("/api/property", propertyRouter);
app.use("/api/tenant", tenantRouter);
app.use("/api", complainRouter);
app.use("/api", analyticsRouter);
app.use("/api/staff", staffRouter);
app.use("/api/payment", paymentRouter); // ❗ NOT webhook
app.use("/api/review", reviewRouter);

/* =======================
   DB + SERVER
======================= */
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("✅ Database connected"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });


/* =======================
 ❤️ HEALTH CHECK (UPTIME ROBOT)
======================= */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: "roomgi-backend"
  });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

/* =======================
   🔥 START PAYMENT WORKER
======================= */
require("./worker/paymentworker");
require("./worker/duescalculateworker");
require("./worker/paymentrentworker");
require("./worker/refundworker");

console.log("🛠 Payment worker started");
