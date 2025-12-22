const { Worker } = require("bullmq");
const Tenant = require("../model/branchmanager/tenants");
const redis = require("../utils/a");

const worker = new Worker(
  "dues", // ✅ SAME AS QUEUE NAME
  async (job) => {

    if (job.name !== "CALCULATE_DUES") return;

    console.log("✅ Dues calculation started");

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const cursor = Tenant.find({ status: "Active" }).cursor();

    for (
      let tenant = await cursor.next();
      tenant != null;
      tenant = await cursor.next()
    ) {

      // ✅ prevent duplicate daily calculation
      if (
        tenant.lastDuesCalculatedAt &&
        tenant.lastDuesCalculatedAt.getTime() === today.getTime()
      ) {
        continue;
      }

      const fromDate = tenant.lastDuesCalculatedAt
        ? new Date(tenant.lastDuesCalculatedAt)
        : new Date(tenant.createdAt);

      fromDate.setUTCHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (today - fromDate) / (1000 * 60 * 60 * 24)
      );

      if (diffDays <= 0) continue;

      let daysRemaining = diffDays;

      const rent = tenant.rent || 0;
      const onedayrent = Number((rent / 30).toFixed(2));

      while (daysRemaining > 0) {

        if (tenant.advanced < onedayrent) {

          if (!tenant.startDuesFrom) {
            tenant.startDuesFrom = new Date(fromDate);
          }

          tenant.duesamount += Number((onedayrent - tenant.advanced).toFixed(2));
          tenant.advanced = 0;
          tenant.duesdays += 1;

          if (tenant.duesdays === 30) {
            tenant.duesmonth += 1;
            tenant.duesdays = 0;
          }

          tenant.paymentStatus = "dues";

        } else {
          tenant.advanced = Number((tenant.advanced - onedayrent).toFixed(2));
        }

        daysRemaining--;
      }

      tenant.lastDuesCalculatedAt = today;
      await tenant.save();
      console.log(tenant)
    }
  },
  {
    connection: redis,
    concurrency: 3,
    limiter: { max: 10, duration: 1000 }
  }
);

module.exports = worker;
