const cron = require("node-cron");
const { refundQueue, refundVerifyQueue } = require("../queue"); // correct path

// 🔹 Run every 5 minutes for refund processing
cron.schedule("*/10 * * * *", async () => {
  console.log("⏰ Refund processing cron triggered:", new Date());

  if (!refundQueue) {
    console.error("❌ refundQueue is undefined");
    return;
  }

  await refundQueue.add("REFUND_PROCESSING", { triggeredAt: new Date() });
});

