const cron = require("node-cron");
const Payment = require("../model/payment");
const Tenant = require("../model/tenants");
const PaymentHistory = require("../model/monthlyhistory");
const PropertyBranch = require("../model/propertyBranch");

cron.schedule("*/30 * * * * *", async () => {
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const allBranches = await PropertyBranch.find();

    for (const branch of allBranches) {

        let MonthlyHistory = await PaymentHistory.findOne({
            branch: branch._id,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        })
        if (MonthlyHistory.length <= 0) {
            console.log("Not Found ")
            MonthlyHistory = await PaymentHistory.create({
                branch: branch._id,
                NotPaid: [],
                dues: 0,
                rent: 0,
                advanced: 0,
            });

        }

        console.log("MonthlyHistory", MonthlyHistory)

        try {
            const allTenants = await Tenant.find({ branch: branch._id });
            console.log("allTenants", allTenants)

            for (const tenant of allTenants) {
                console.log("tenant", tenant)

                if (tenant.createdAt > endOfMonth) continue;

                let totalPaid = 0;

                const payments = await Payment.find({
                    tenant: tenant._id,
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                });
                console.log("payments", payments)

                MonthlyHistory.rent += tenant.Rent;

                if (payments.length === 0) {
                    MonthlyHistory.NotPaid.push(tenant._id);
                    MonthlyHistory.dues += tenant.Rent;

                } else {
                    for (const p of payments) {
                        totalPaid += p.amountpaid;
                    }

                    if (totalPaid < tenant.Rent) {
                        MonthlyHistory.dues += (tenant.Rent - totalPaid);
                    } else if (totalPaid > tenant.Rent) {
                        MonthlyHistory.advanced += (totalPaid - tenant.Rent);
                    }
                }
            }

            await MonthlyHistory.save();
            console.log("MonthlyHistory", MonthlyHistory)

            console.log(` Monthly record created for branch ${branch._id}`);
        } catch (error) {
            console.error(` Error processing branch ${branch._id}:`, error.message);
        }
    }
});
