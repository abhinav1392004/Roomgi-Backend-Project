const cron = require("node-cron");
const { duesQueue } = require("../queue"); // <-- path correct ho

// 🔹 Run every 1 minute
cron.schedule("* * * * *", async () => {
    console.log("cron trigger")
  await duesQueue.add("CALCULATE_DUES", {
    triggeredAt: new Date()
  });
});
