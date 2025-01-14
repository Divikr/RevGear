const Orders=require("../../model/Order")
const User=require("../../model/users")
const moment = require('moment')
const PDFDocument = require('pdfkit');

const loadSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = 10; 
        const skip = (page - 1) * limit; 

        const totalOrders = await Orders.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Orders.find({})
            .populate('userId')
            .populate('deliveryAddress')
            .populate({ path: 'items.productId', model: 'Product' }) 
            .sort({ _id: -1 })
            .skip(skip)
            .limit(limit);

        const formattedOrders = orders.map(order => {
            const date = new Date(order.createdAt);
            const formattedDate = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
            return {
                ...order.toObject(),
                formattedCreatedAt: formattedDate,
            };
        });

        res.render('saleReport', {
            orderDetails: formattedOrders,
            currentPage: page,
            totalPages,
        });
    } catch (error) {
        console.error('Error loading sales report page:', error);
        res.status(500).send('Error loading sales report page');
    }
};

const dailySalesReport = async (req, res) => {
    try {
        const startDate = moment().startOf('day').local().toDate(); 
        const endDate = moment().endOf('day').local().toDate(); 

        console.log('Start Date (Local Timezone):', startDate);
        console.log('End Date (Local Timezone):', endDate);

        const dailyReport = await Orders.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: 'coupons',
                    localField: 'couponApplied',
                    foreignField: '_id',
                    as: 'couponDetails'
                }
            },
            {
                $addFields: {
                    couponDiscount: {
                        $cond: {
                            if: { $gt: [{ $size: "$couponDetails" }, 0] },
                            then: {
                                $cond: [
                                    { $eq: [{ $arrayElemAt: ["$couponDetails.offerType", 0] }, "percentage"] },
                                    {
                                        $multiply: [
                                            "$totalAmount",
                                            { $divide: [{ $arrayElemAt: ["$couponDetails.offerValue", 0] }, 100] }
                                        ]
                                    },
                                    { $arrayElemAt: ["$couponDetails.offerValue", 0] }
                                ]
                            },
                            else: 0
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    totalOrders: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    totalCouponAmount: { $sum: "$couponDiscount" }
                }
            }
        ]);

        if (dailyReport.length === 0) {
            console.log('No orders found for today.');
        } else {
            console.log('Daily Report:', dailyReport); 
        }

        const totalOrders = dailyReport.reduce((acc, curr) => acc + curr.totalOrders, 0);
        const totalAmount = dailyReport.reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalCouponAmount = dailyReport.reduce((acc, curr) => acc + curr.totalCouponAmount, 0);

        res.render('reports', { report: dailyReport, totalOrders, totalAmount, totalCouponAmount });
    } catch (error) {
        console.error('Error loading daily sales report:', error);
        res.status(500).send('Error loading daily sales report');
    }
};

const generateWeeklyReport = async (req, res) => {
    try {
        const startDate = moment().startOf('isoWeek').toDate();
        const endDate = moment().endOf('isoWeek').toDate();

        console.log('Start Date (Weekly):', startDate);
        console.log('End Date (Weekly):', endDate);

        const weeklyReport = await Orders.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lte: endDate },
                    orderStatus: { 
                        $nin: ['Cancelled', 'Return Success'] 
                    }
                }
            },
            {
                $lookup: {
                    from: 'coupons',
                    localField: 'couponApplied',
                    foreignField: '_id',
                    as: 'couponDetails'
                }
            },
            {
                $unwind: {
                    path: "$couponDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    couponDiscount: {
                        $cond: {
                            if: { $ne: ["$couponDetails", null] },
                            then: {
                                $switch: {
                                    branches: [
                                        {
                                            case: { $eq: ["$couponDetails.offerType", "Percentage"] },
                                            then: {
                                                $multiply: [
                                                    "$totalAmount",
                                                    { $divide: ["$couponDetails.offerValue", 100] }
                                                ]
                                            }
                                        },
                                        {
                                            case: { $eq: ["$couponDetails.offerType", "flat"] },
                                            then: "$couponDetails.offerValue"
                                        }
                                    ],
                                    default: 0
                                }
                            },
                            else: { $ifNull: ["$offerApplied", 0] }  // Use offerApplied if no coupon
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { 
                        $dateToString: { 
                            format: "%Y-%m-%d", 
                            date: "$orderDate" 
                        }
                    },
                    totalOrders: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    totalCouponAmount: { $sum: "$couponDiscount" }
                }
            },
            {
                $sort: { "_id": 1 }
            }
        ]);

        // Calculate totals
        const totalOrders = weeklyReport.reduce((acc, curr) => acc + curr.totalOrders, 0);
        const totalAmount = weeklyReport.reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalCouponAmount = weeklyReport.reduce((acc, curr) => acc + (curr.totalCouponAmount || 0), 0);

        // For debugging
        console.log('Weekly Report Data:', JSON.stringify(weeklyReport, null, 2));
        console.log('Total Coupon Amount:', totalCouponAmount);

        res.render('reports', { 
            report: weeklyReport, 
            totalOrders, 
            totalAmount, 
            totalCouponAmount,
            reportType: 'weekly'
        });
    } catch (error) {
        console.error('Error generating weekly report:', error);
        res.status(500).send('Error generating weekly report');
    }
};


const generateMonthlyReport = async (req, res) => {
    try {
        const monthlyReport = await Orders.aggregate([
            {
                $lookup: {
                    from: 'coupons',
                    localField: 'couponApplied',
                    foreignField: '_id',
                    as: 'couponDetails'
                }
            },
            {
                $addFields: {
                    couponDiscount: {
                        $cond: {
                            if: { $gt: [{ $size: "$couponDetails" }, 0] },
                            then: {
                                $cond: [
                                    { $eq: [{ $arrayElemAt: ["$couponDetails.offerType", 0] }, "percentage"] },
                                    {
                                        $multiply: [
                                            "$totalAmount",
                                            { $divide: [{ $arrayElemAt: ["$couponDetails.offerValue", 0] }, 100] }
                                        ]
                                    },
                                    { $arrayElemAt: ["$couponDetails.offerValue", 0] }
                                ]
                            },
                            else: 0
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    totalOrders: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    totalCouponAmount: { $sum: "$couponDiscount" }
                }
            }
        ]);

        const formattedReport = monthlyReport.map(report => ({
            _id: moment().month(report._id - 1).format('MMMM'),
            totalOrders: report.totalOrders,
            totalAmount: report.totalAmount,
            totalCouponAmount: report.totalCouponAmount || 0
        }));

        const totalOrders = formattedReport.reduce((acc, curr) => acc + curr.totalOrders, 0);
        const totalAmount = formattedReport.reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalCouponAmount = formattedReport.reduce((acc, curr) => acc + curr.totalCouponAmount, 0);

        res.render('reports', {
            report: formattedReport,
            totalOrders,
            totalAmount,
            totalCouponAmount
        });
    } catch (error) {
        console.error('Error generating monthly report:', error);
        res.status(500).send('Error generating monthly report');
    }
};

const generateYearlyReport = async (req, res) => {
    try {
        const yearlyReport = await Orders.aggregate([
            {
                $lookup: {
                    from: 'coupons',
                    localField: 'couponApplied',
                    foreignField: '_id',
                    as: 'couponDetails'
                }
            },
            {
                $addFields: {
                    couponDiscount: {
                        $cond: {
                            if: { $gt: [{ $size: "$couponDetails" }, 0] },
                            then: {
                                $cond: [
                                    { $eq: [{ $arrayElemAt: ["$couponDetails.offerType", 0] }, "percentage"] },
                                    {
                                        $multiply: [
                                            "$totalAmount",
                                            { $divide: [{ $arrayElemAt: ["$couponDetails.offerValue", 0] }, 100] }
                                        ]
                                    },
                                    { $arrayElemAt: ["$couponDetails.offerValue", 0] }
                                ]
                            },
                            else: 0
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { $year: "$createdAt" },
                    totalOrders: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    totalCouponAmount: { $sum: "$couponDiscount" }
                }
            }
        ]);

        const totalOrders = yearlyReport.reduce((acc, curr) => acc + curr.totalOrders, 0);
        const totalAmount = yearlyReport.reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalCouponAmount = yearlyReport.reduce((acc, curr) => acc + curr.totalCouponAmount, 0);

        res.render('reports', { report: yearlyReport, totalOrders, totalAmount, totalCouponAmount });
    } catch (error) {
        console.error('Error generating yearly report:', error);
        res.status(500).send('Error generating yearly report');
    }
};

const generateCustomDateReport = async (req, res) => {
    try {
        const startDate = moment(req.query.startDate, 'YYYY-MM-DD', true).startOf('day');
        const endDate = moment(req.query.endDate, 'YYYY-MM-DD', true).endOf('day');

        if (!startDate.isValid() || !endDate.isValid()) {
            return res.status(400).send('Invalid date format. Please use YYYY-MM-DD.');
        }
        if (startDate.isAfter(endDate)) {
            return res.status(400).send('Start date cannot be after end date.');
        }

        const customDateReport = await Orders.aggregate([
            {
                $match: {
                    orderDate: { 
                        $gte: startDate.toDate(), 
                        $lte: endDate.toDate() 
                    },
                    orderStatus: { 
                        $nin: ['Cancelled', 'Return Success'] 
                    }
                }
            },
            {
                $lookup: {
                    from: 'coupons',
                    localField: 'couponApplied',
                    foreignField: '_id',
                    as: 'couponDetails'
                }
            },
            {
                $unwind: {
                    path: "$couponDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    couponDiscount: {
                        $cond: {
                            if: { $ne: ["$couponDetails", null] },
                            then: {
                                $switch: {
                                    branches: [
                                        {
                                            case: { $eq: ["$couponDetails.offerType", "Percentage"] },
                                            then: {
                                                $multiply: [
                                                    "$totalAmount",
                                                    { $divide: ["$couponDetails.offerValue", 100] }
                                                ]
                                            }
                                        },
                                        {
                                            case: { $eq: ["$couponDetails.offerType", "flat"] },
                                            then: "$couponDetails.offerValue"
                                        }
                                    ],
                                    default: 0
                                }
                            },
                            else: { $ifNull: ["$offerApplied", 0] }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { 
                        $dateToString: { 
                            format: "%Y-%m-%d", 
                            date: "$orderDate" 
                        }
                    },
                    totalOrders: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    totalCouponAmount: { $sum: "$couponDiscount" }
                }
            },
            {
                $sort: { "_id": 1 }
            }
        ]);

        // Calculate totals
        const totalOrders = customDateReport.reduce((acc, curr) => acc + curr.totalOrders, 0);
        const totalAmount = customDateReport.reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalCouponAmount = customDateReport.reduce((acc, curr) => acc + (curr.totalCouponAmount || 0), 0);

        // Debug logging
        console.log('Custom Date Report Data:', JSON.stringify(customDateReport, null, 2));
        console.log('Total Amount:', totalAmount);
        console.log('Total Orders:', totalOrders);
        console.log('Total Coupon Amount:', totalCouponAmount);

        res.render('reports', {
            report: customDateReport,
            startDate: startDate.format('YYYY-MM-DD'),
            endDate: endDate.format('YYYY-MM-DD'),
            totalAmount: totalAmount.toFixed(2),
            totalOrders,
            totalCouponAmount: totalCouponAmount.toFixed(2),
            reportType: 'custom'
        });
    } catch (error) {
        console.error('Error generating custom date report:', error);
        res.status(500).send('Error generating custom date report');
    }
};


module.exports={
    loadSalesReport,
    dailySalesReport,
    generateWeeklyReport,
    generateMonthlyReport,
    generateYearlyReport,
    generateCustomDateReport,

}