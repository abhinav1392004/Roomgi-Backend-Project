

const property = require("../model/branchmanager/property")
const Payment = require("../model/branchmanager/payment")
const propertyBranch = require("../model/owner/propertyBranch")
const Tenant = require("../model/branchmanager/tenants")

async function findingbranch(id) {
    const propertybranch = await propertyBranch.find({ owner: id }).populate("owner");
    return propertybranch
}

exports.propertyperformancesummary = async (req, res) => {

    try {
        const userId = req.user._id;

        const AllProperty = await propertyBranch.find({ owner: userId }).populate("owner");
        if (AllProperty.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No branches uploaded yet",
                branchdetail: []
            });
        }
        let branchdetail = [];
        let estimatedRevinue = 0;
        let count = 0;

        for (let i = 0; i < AllProperty.length; i++) {
            const foundedtotatltenant = await Tenant.find({ branch: AllProperty[i]._id });
            if (foundedtotatltenant.length > 0) {
                for (let j = 0; j < foundedtotatltenant.length; j++) {
                    if (foundedtotatltenant[j].status === "Active") {
                        count++;
                        estimatedRevinue += foundedtotatltenant[j].Rent;
                    }
                }
            }
            const occupied = count;
            const vacant = AllProperty[i].totalBeds - occupied;
            const occupancyRate = (occupied / AllProperty[i].totalBeds) * 100;
            const Branchdata = {
                branchAddress: AllProperty[i].address,
                branchCity: AllProperty[i].city,
                branchState: AllProperty[i].state,
                totalBeds: AllProperty[i].totalBeds,
                occupiedBeds: occupied,
                occupancyRate: occupancyRate,
                vacant: vacant,
                estimatedRevinue: estimatedRevinue
            }
            branchdetail.push(Branchdata);
            count = 0;
            estimatedRevinue = 0;
        }

        return res.status(200).json({
            success: true,
            messaeg: "property Performance Summary",
            branchdetail: branchdetail
        })


    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

exports.TenantActivitySummary = async (req, res) => {

    try {
        const userId = req.user._id;

        const property = await findingbranch(userId);
        if (property.length <= 0) {
            return res.status(400).json({
                success: true,
                message: "NOT any Branch To show"
            })
        }
        let out = 0;
        let act = 0;
        let inact = 0;
        let checkin = 0

        for (let i = 0; i < property.length; i++) {
            const alltenat = await Tenant.find({ branch: property[i] });
            checkin += alltenat.length
            for (let j = 0; j < alltenat.length; j++) {
                if (alltenat[j].checkedoutdate) {
                    out++;
                }
                if (alltenat[j].status == "Active") {
                    act++;
                }
                if (alltenat[j].status == "In-Active") {
                    inact++;
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: "all details of tenant ",
            checkin: checkin,
            checkout: out,
            active: act,
            inactive: inact
        })





    } catch (error) {
        console.log(error)
        return res.status(500).json({
            succes: false,
            message: "internal Server error"
        })

    }
}

exports.Insightsgetting = async (req, res) => {

    try {
        const id = req.user._id;

        const property = await findingbranch(id);

        if (property.length <= 0) {
            return res.status(400).json({
                success: true,
                message: "NOT any Branch To show"
            })
        }
        let alldata = [];


        let occupiedroom = 0;
        let totalbed = 0;
        let rating = 0;
        let count = 0;
        let totalMonths = 0;
        let totalTenants = 0;



        for (let i = 0; i < property.length; i++) {

            occupiedroom += property[i].occupiedRoom.length
            totalbed += property[i].totalBeds

            if (property[i].Rating != null) {
                rating += property[i].Rating;
                count++;
            }

            const alltenat = await Tenant.find({ branch: property[i] });
            for (let i = 0; i < alltenat.length; i++) {
                if (alltenat[i].checkInDate && alltenat[i].checkedoutdate) {
                    const moveIn = new Date(alltenat[i].checkInDate);
                    const moveOut = new Date(alltenat[i].checkedoutdate);

                    const months = (moveOut.getFullYear() - moveIn.getFullYear()) * 12 +
                        (moveOut.getMonth() - moveIn.getMonth());
                    totalMonths += months;
                    totalTenants++;
                }
            }



        }
        const occupancy = Math.floor(occupiedroom / totalbed);
        const avgrating = rating / count;
        const avgduration=totalMonths/totalTenants
        const data = {
            occupancy,
            avgrating,
            avgduration
        }
        alldata.push(data)


        return res.status(200).json({
            succes: true,
            message: "property comparison data  ",
            alldata,
        })


    } catch (error) {
        console.log(error)
        return res.status(500).json({
            succes: false,
            message: "Internal server error "
        })

    }
}



exports.propertyComparison = async (req, res) => {

    try {
        const id = req.user._id;

        const property = await findingbranch(id);

        if (property.length <= 0) {
            return res.status(400).json({
                success: true,
                message: "NOT any Branch To show"
            })
        }
        let allbranch = [];

        let performance = "";
        let revenue = 0;



        for (let i = 0; i < property.length; i++) {

            let OccupancyRate = ((property[i].totalBeds) - (property[i].totalBeds - property[i].occupiedRoom.length)) / property[i].totalBeds
            let name = property[i].name
            if (OccupancyRate > 70) {
                performance = "Excellent"

            }
            else if (OccupancyRate > 50) {
                performance = "Good"

            }
            else {
                performance = "Needs Attention "

            }
            let rating = property[i].Rating
            const alltenat = await Tenant.find({ branch: property[i] });
            for (let i = 0; i < alltenat.length; i++) {
                if (alltenat[i].status == "Active") {
                    revenue += alltenat[i].Rent
                }

            }


            const data = {
                occupancy: OccupancyRate,
                name: "N/A",
                performance,
                rating,
                revenue
            }



            allbranch.push(data)

        }
        return res.status(200).json({
            succes: true,
            message: "property comparison data  ",
            allbranch,
        })


    } catch (error) {
        console.log(error)
        return res.status(500).json({
            succes: false,
            message: "Internal server error "
        })

    }
}

exports.OccupancyRateTrend = async (req, res) => {

    try {
        const userId = req.user._id;
        console.log(userId)
        let Tennantoccupied = []

        const property = await propertyBranch.find({ owner: userId })
        if (property.length == 0) {
            return res.status(200).json({
                succes: true,
                message: "NO Branches Founded"
            })
        }
        for (const brach of property) {
            const Tennantoccupieddata = await Tenant.aggregate([
                { $match: { branch: brach._id } },
                {
                    $group: {
                        _id: { month: { $month: "$checkInDate" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.month": 1 } },
            ])
            Tennantoccupied.push(...Tennantoccupieddata)
        }
        let occupancymap = {}

        Tennantoccupied.forEach((item) => {
            const m = item._id.month;
            occupancymap[m] = { month: m, occupied: item.count }
        })
        return res.status(200).json({
            success: true,
            message: "Occupancy Rate Trend",
            occupancymap: occupancymap,
            property
        })





    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Iternal server Error"
        })

    }
}


exports.Tenantactivity = async (req, res) => {

    try {
        const userId = req.user._id;
        let checkins = [];
        let checkout = [];
        const property = await propertyBranch.find({ owner: userId }).populate("owner");
        if (property.length > 0) {
            for (let i = 0; i < property.length; i++) {

                checkins = await Tenant.aggregate([
                    { $match: { branch: property[i]._id, checkInDate: { $ne: null } } },
                    {
                        $group: {
                            _id: { month: { $month: "$checkInDate" } },
                            count: { $sum: 1 },
                        }
                    },
                    { $sort: { "_id.month": 1 } },
                ]);

                checkout = await Tenant.aggregate([
                    { $match: { branch: property[i]._id, checkedoutdate: { $ne: null } } },
                    {
                        $group: {
                            _id: { month: { $month: "$checkOutDate" } },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { "_id.month": 1 } },
                ]);
            }
        }

        const monthmap = {};
        let month;

        checkins.forEach((item) => {
            const m = item._id.month;
            monthmap[m] = { month: m, checkin: item.count, checkout: 0 }
        })
        checkout.forEach((item) => {
            const m = item._id.month;

            monthmap[m] = { ...monthmap[m], checkout: item.count }
        })
        const monthlyActivity = Object.values(monthmap).sort((a, b) => a.month - b.month);


        return res.status(200).json({
            success: true,
            message: "tenant Activity",
            monthlyActivity
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            messge: "Internal server rror"
        })

    }
}


exports.GetPaymentCollectionReport = async (req, res) => {

    try {
        const userId = req.user._id;
        let monthlypaidReport = [];

        const allbranch = await propertyBranch.find({ owner: userId });
        if (allbranch.length == 0) {
            return res.status(200).json({
                success: true,
                message: "Not have any Branched "
            })
        }
        for (let i = 0; i < allbranch.length; i++) {

            const monthlypaidReportdata = await Payment.aggregate([
                { $match: { branch: allbranch[i]._id, createdAt: { $ne: null } } },
                {
                    $group: {
                        _id: { month: { $month: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.month": 1 } }
            ])
            monthlypaidReport.push(...monthlypaidReportdata);

        }

        let paymentmap = {}

        monthlypaidReport.forEach((items) => {
            const m = items._id.month;
            paymentmap[m] = { month: m, totalPayment: items.count }
        })


        return res.status(200).json({
            success: true,
            message: "Monthly report is",
            paymentmap
        })





    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Iternal server Error"
        })

    }
}

exports.PaymentStatusDistribution = async (req, res) => {
    try {
        const id = req.user._id; // owner id
        const branches = await findingbranch(id);

        if (!branches || branches.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No branches uploaded yet",
                branchdetail: [],
            });
        }

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        let branchDetails = [];

        for (let branch of branches) {
            const tenants = await Tenant.find({ branch: branch._id });
            let onTime = 0;
            let overdue = 0;
            let pending = 0;

            for (let tenant of tenants) {
                // Get latest payment for this tenant
                const latestPayment = await Payment.findOne({ tenantId: tenant._id })
                    .sort({ date: -1 });

                // Define expected due date (e.g., 5th of every month)
                const dueDate = new Date(currentYear, currentMonth, 5);

                if (!latestPayment) {
                    pending++;
                    continue;
                }

                const paymentDate = new Date(latestPayment.date);
                const paymentMonth = paymentDate.getMonth();
                const paymentYear = paymentDate.getFullYear();

                // If payment was made for this month
                if (paymentMonth === currentMonth && paymentYear === currentYear) {
                    if (paymentDate <= dueDate) onTime++;
                    else overdue++;
                } else {
                    pending++;
                }
            }

            branchDetails.push({
                branchName: branch.name,
                onTime,
                overdue,
                pending,
            });
        }

        res.status(200).json({
            success: true,
            message: "Payment Status Distribution Fetched Successfully",
            branchDetails,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};
