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
     
        const startDate = moment().startOf('day').toDate();
        const endDate = moment().endOf('day').toDate();

        const dailyReport = await Orders.aggregate([
            {
                $match: {
                    orderDate: { 
                        $gte: startDate, 
                        $lte: endDate 
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
                $addFields: {
                    
                    finalAmount: {
                        $subtract: [
                            "$totalAmount",
                            {
                                $add: [
                                    "$offerApplied",
                                    {
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
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        hour: { $hour: "$orderDate" }
                    },
                    totalOrders: { $sum: 1 },
                    grossAmount: { $sum: "$totalAmount" },
                    totalCouponDiscount: { 
                        $sum: {
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
                    },
                    totalOfferDiscount: { $sum: "$offerApplied" },
                    netAmount: { $sum: "$finalAmount" }
                }
            },
            {
                $sort: { "_id.hour": 1 }
            }
        ]);

        
        const formattedReport = Array.from({ length: 24 }, (_, hour) => {
            const hourData = dailyReport.find(report => report._id.hour === hour) || {
                totalOrders: 0,
                grossAmount: 0,
                totalCouponDiscount: 0,
                totalOfferDiscount: 0,
                netAmount: 0
            };

            return {
                _id: `${hour.toString().padStart(2, '0')}:00`,
                ...hourData
            };
        });

        const totals = formattedReport.reduce((acc, curr) => ({
            totalOrders: acc.totalOrders + curr.totalOrders,
            grossAmount: acc.grossAmount + curr.grossAmount,
            totalCouponDiscount: acc.totalCouponDiscount + curr.totalCouponDiscount,
            totalOfferDiscount: acc.totalOfferDiscount + curr.totalOfferDiscount,
            netAmount: acc.netAmount + curr.netAmount
        }), {
            totalOrders: 0,
            grossAmount: 0,
            totalCouponDiscount: 0,
            totalOfferDiscount: 0,
            netAmount: 0
        });

        res.render('reports', {
            report: formattedReport,
            totals: totals,
            reportType: 'daily'
        });

    } catch (error) {
        console.error('Error generating daily report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating daily report',
            error: error.message
        });
    }
};

const generateWeeklyReport = async (req, res) => {
    try {
        
        const startDate = moment().startOf('isoWeek').toDate();
        const endDate = moment().endOf('isoWeek').toDate();

        const weeklyReport = await Orders.aggregate([
            {
                $match: {
                    orderDate: { 
                        $gte: startDate, 
                        $lte: endDate 
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
                $addFields: {
                    
                    finalAmount: {
                        $subtract: [
                            "$totalAmount",
                            {
                                $add: [
                                    "$offerApplied",
                                    {
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
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        dayOfWeek: { $dayOfWeek: "$orderDate" }
                    },
                    totalOrders: { $sum: 1 },
                    grossAmount: { $sum: "$totalAmount" },
                    totalCouponDiscount: { 
                        $sum: {
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
                    },
                    totalOfferDiscount: { $sum: "$offerApplied" },
                    netAmount: { $sum: "$finalAmount" }
                }
            },
            {
                $sort: { "_id.dayOfWeek": 1 }
            }
        ]);

        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const formattedReport = daysOfWeek.map((day, index) => {
            const dayData = weeklyReport.find(report => report._id.dayOfWeek === index + 1) || {
                totalOrders: 0,
                grossAmount: 0,
                totalCouponDiscount: 0,
                totalOfferDiscount: 0,
                netAmount: 0
            };

            return {
                _id: day,
                ...dayData
            };
        });


        const totals = formattedReport.reduce((acc, curr) => ({
            totalOrders: acc.totalOrders + curr.totalOrders,
            grossAmount: acc.grossAmount + curr.grossAmount,
            totalCouponDiscount: acc.totalCouponDiscount + curr.totalCouponDiscount,
            totalOfferDiscount: acc.totalOfferDiscount + curr.totalOfferDiscount,
            netAmount: acc.netAmount + curr.netAmount
        }), {
            totalOrders: 0,
            grossAmount: 0,
            totalCouponDiscount: 0,
            totalOfferDiscount: 0,
            netAmount: 0
        });

        res.render('reports', {
            report: formattedReport,
            totals: totals,
            reportType: 'weekly'
        });

    } catch (error) {
        console.error('Error generating weekly report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating weekly report',
            error: error.message
        });
    }
};

const generateMonthlyReport = async (req, res) => {
    try {

        const currentYear = new Date().getFullYear();
        const startDate = new Date(currentYear, 0, 1);
        const endDate = new Date(currentYear, 11, 31);

        const monthlyReport = await Orders.aggregate([
            {
                $match: {
                    orderDate: { 
                        $gte: startDate, 
                        $lte: endDate 
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
                $addFields: {
             
                    finalAmount: {
                        $subtract: [
                            "$totalAmount",
                            {
                                $add: [
                                    "$offerApplied",
                                    {
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
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: { 
                        year: { $year: "$orderDate" },
                        month: { $month: "$orderDate" }
                    },
                    totalOrders: { $sum: 1 },
                    grossAmount: { $sum: "$totalAmount" },
                    totalCouponDiscount: { 
                        $sum: {
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
                    },
                    totalOfferDiscount: { $sum: "$offerApplied" },
                    netAmount: { $sum: "$finalAmount" }
                }
            },
            {
                $sort: { 
                    "_id.year": 1,
                    "_id.month": 1
                }
            }
        ]);

    
        const formattedReport = monthlyReport.map(report => ({
            _id: moment().month(report._id.month - 1).format('MMMM'),
            totalOrders: report.totalOrders,
            grossAmount: report.grossAmount,
            totalCouponDiscount: report.totalCouponDiscount,
            totalOfferDiscount: report.totalOfferDiscount,
            netAmount: report.netAmount
        }));

       
        const totals = formattedReport.reduce((acc, curr) => ({
            totalOrders: acc.totalOrders + curr.totalOrders,
            grossAmount: acc.grossAmount + curr.grossAmount,
            totalCouponDiscount: acc.totalCouponDiscount + curr.totalCouponDiscount,
            totalOfferDiscount: acc.totalOfferDiscount + curr.totalOfferDiscount,
            netAmount: acc.netAmount + curr.netAmount
        }), {
            totalOrders: 0,
            grossAmount: 0,
            totalCouponDiscount: 0,
            totalOfferDiscount: 0,
            netAmount: 0
        });

      
        const allMonths = moment.months();
        const completeReport = allMonths.map(month => {
            const existingReport = formattedReport.find(report => report._id === month);
            return existingReport || {
                _id: month,
                totalOrders: 0,
                grossAmount: 0,
                totalCouponDiscount: 0,
                totalOfferDiscount: 0,
                netAmount: 0
            };
        });

        res.render('reports', {
            report: completeReport,
            totals: totals
        });

    } catch (error) {
        console.error('Error generating monthly report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating monthly report',
            error: error.message
        });
    }
};

const generateYearlyReport = async (req, res) => {
    try {
     
        const oldestOrder = await Orders.findOne().sort({ orderDate: 1 });
        const startYear = oldestOrder ? moment(oldestOrder.orderDate).year() : moment().year();
        const currentYear = moment().year();
        
        const yearlyReport = await Orders.aggregate([
            {
                $match: {
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
                $addFields: {
                   
                    finalAmount: {
                        $subtract: [
                            "$totalAmount",
                            {
                                $add: [
                                    "$offerApplied",
                                    {
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
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: { year: { $year: "$orderDate" } },
                    totalOrders: { $sum: 1 },
                    grossAmount: { $sum: "$totalAmount" },
                    totalCouponDiscount: { 
                        $sum: {
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
                    },
                    totalOfferDiscount: { $sum: "$offerApplied" },
                    netAmount: { $sum: "$finalAmount" }
                }
            },
            {
                $sort: { "_id.year": 1 }
            }
        ]);

  
        const formattedReport = Array.from(
            { length: currentYear - startYear + 1 },
            (_, index) => {
                const year = startYear + index;
                const yearData = yearlyReport.find(report => report._id.year === year) || {
                    totalOrders: 0,
                    grossAmount: 0,
                    totalCouponDiscount: 0,
                    totalOfferDiscount: 0,
                    netAmount: 0
                };

                return {
                    _id: year.toString(),
                    ...yearData
                };
            }
        );

      
        const totals = formattedReport.reduce((acc, curr) => ({
            totalOrders: acc.totalOrders + curr.totalOrders,
            grossAmount: acc.grossAmount + curr.grossAmount,
            totalCouponDiscount: acc.totalCouponDiscount + curr.totalCouponDiscount,
            totalOfferDiscount: acc.totalOfferDiscount + curr.totalOfferDiscount,
            netAmount: acc.netAmount + curr.netAmount
        }), {
            totalOrders: 0,
            grossAmount: 0,
            totalCouponDiscount: 0,
            totalOfferDiscount: 0,
            netAmount: 0
        });

        res.render('reports', {
            report: formattedReport,
            totals: totals,
            reportType: 'yearly'
        });

    } catch (error) {
        console.error('Error generating yearly report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating yearly report',
            error: error.message
        });
    }
};

const generateCustomDateReport = async (req, res) => {
    try {
        const startDate = moment(req.query.startDate, 'YYYY-MM-DD').startOf('day');
        const endDate = moment(req.query.endDate, 'YYYY-MM-DD').endOf('day');

  
        if (!startDate.isValid() || !endDate.isValid()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Please use YYYY-MM-DD.'
            });
        }

        if (startDate.isAfter(endDate)) {
            return res.status(400).json({
                success: false,
                message: 'Start date cannot be after end date.'
            });
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
                $addFields: {
                   
                    finalAmount: {
                        $subtract: [
                            "$totalAmount",
                            {
                                $add: [
                                    "$offerApplied",
                                    {
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
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } }
                    },
                    totalOrders: { $sum: 1 },
                    grossAmount: { $sum: "$totalAmount" },
                    totalCouponDiscount: { 
                        $sum: {
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
                    },
                    totalOfferDiscount: { $sum: "$offerApplied" },
                    netAmount: { $sum: "$finalAmount" }
                }
            },
            {
                $sort: { "_id.date": 1 }
            }
        ]);

        const allDates = [];
        const currentDate = startDate.clone();
        while (currentDate.isSameOrBefore(endDate)) {
            allDates.push(currentDate.format('YYYY-MM-DD'));
            currentDate.add(1, 'day');
        }

        const formattedReport = allDates.map(date => {
            const dateData = customDateReport.find(report => report._id.date === date) || {
                totalOrders: 0,
                grossAmount: 0,
                totalCouponDiscount: 0,
                totalOfferDiscount: 0,
                netAmount: 0
            };

            return {
                _id: date,
                ...dateData
            };
        });


        const totals = formattedReport.reduce((acc, curr) => ({
            totalOrders: acc.totalOrders + curr.totalOrders,
            grossAmount: acc.grossAmount + curr.grossAmount,
            totalCouponDiscount: acc.totalCouponDiscount + curr.totalCouponDiscount,
            totalOfferDiscount: acc.totalOfferDiscount + curr.totalOfferDiscount,
            netAmount: acc.netAmount + curr.netAmount
        }), {
            totalOrders: 0,
            grossAmount: 0,
            totalCouponDiscount: 0,
            totalOfferDiscount: 0,
            netAmount: 0
        });

        res.render('reports', {
            report: formattedReport,
            totals: totals,
            startDate: startDate.format('YYYY-MM-DD'),
            endDate: endDate.format('YYYY-MM-DD'),
            reportType: 'custom'
        });

    } catch (error) {
        console.error('Error generating custom date report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating custom date report',
            error: error.message
        });
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