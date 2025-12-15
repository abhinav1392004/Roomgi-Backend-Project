const cron = require("node-cron");
const Tenant = require("../model/tenants");

cron.schedule("* * * * * *", async () => {
  console.log("running")
  try {
    const tenants = await Tenant.find();


    for (const tenant of tenants) {
      try {
        const onedayrent = Math.floor(tenant.Rent / 30);
        if (tenant.advanced < onedayrent) {
          tenant.dues += onedayrent - tenant.advanced
          tenant.advanced = 0
        }else {
            tenant.advanced -= onedayrent;
        }
        if (tenant.dues > 0) {
          const totaldays = tenant.dues / onedayrent;
          const month = Math.floor(totaldays / 30);
          const days = totaldays - month * 30;
          tenant.duesmonth = month;
          tenant.duesdays = days;
          tenant.paymentstatus =
            tenant.dues > 0 && tenant.securitydeposit < tenant.dues
              ? "over-dues"
              : tenant.dues > 0
                ? "dues"
                : "paid";
        }
        await tenant.save();
      } catch (tenantError) {
        console.error(`Error updating tenant ${tenant._id}:`, tenantError.message);
      }
    }


  } catch (error) {
    console.error(" Cron job failed:", error);
  }
}
)