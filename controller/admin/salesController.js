const Orders=require("../../model/Order")
const User=require("../../model/users")
const moment = require('moment')
const PDFDocument = require('pdfkit');

const loadSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number
        const limit = 10; // Number of records per page
        const skip = (page - 1) * limit; // Number of records to skip

        const totalOrders = await Orders.countDocuments(); // Total number of orders
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Orders.find({})
            .populate('userId')
            .populate('deliveryAddress')
            .populate({ path: 'items.productId', model: 'Product' }) // Corrected path
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
        // Get the start and end of the day in your local timezone
        const startDate = moment().startOf('day').local().toDate(); // Start of today in local timezone
        const endDate = moment().endOf('day').local().toDate(); // End of today in local timezone

        console.log('Start Date (Local Timezone):', startDate);
        console.log('End Date (Local Timezone):', endDate);

        // Aggregate to generate the daily sales report
        const dailyReport = await Orders.aggregate([
            {
                // Match orders created today (local timezone)
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                // Group by the date to calculate totals
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalOrders: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    totalCouponAmount: { $sum: "$couponDiscount" }
                }
            }
        ]);

        // If no data is found
        if (dailyReport.length === 0) {
            console.log('No orders found for today.');
        } else {
            console.log('Daily Report:', dailyReport); // Log the result
        }

        // Calculate the totals
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
        // Get the start and end of the current week in your local timezone (consider Sunday as the start of the week)
        const startDate = moment().startOf('week').local().toDate();
        const endDate = moment().endOf('week').local().toDate();

        console.log('Start Date (Weekly):', startDate);
        console.log('End Date (Weekly):', endDate);

        // Aggregate to generate the weekly sales report
        const weeklyReport = await Orders.aggregate([
            {
                // Match orders created within the week (local timezone)
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
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
                // Group by the week to calculate totals
                $group: {
                    _id: { $week: "$createdAt" },
                    totalOrders: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    totalCouponAmount: { $sum: "$couponDiscount" }
                }
            }
        ]);

        // Calculate the totals
        const totalOrders = weeklyReport.reduce((acc, curr) => acc + curr.totalOrders, 0);
        const totalAmount = weeklyReport.reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalCouponAmount = weeklyReport.reduce((acc, curr) => acc + curr.totalCouponAmount, 0);

        res.render('reports', { report: weeklyReport, totalOrders, totalAmount, totalCouponAmount });
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

        // Validate dates
        if (!startDate.isValid() || !endDate.isValid()) {
            return res.status(400).send('Invalid date format. Please use YYYY-MM-DD.');
        }
        if (startDate.isAfter(endDate)) {
            return res.status(400).send('Start date cannot be after end date.');
        }

        // Query orders within the date range
        const customDateReport = await Orders.find({
            createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
        });

        // Calculate totals
        let totalAmount = 0;
        let totalOrders = customDateReport.length;

        customDateReport.forEach(order => {
            if (order.totalAmount && !isNaN(order.totalAmount)) {
                totalAmount += parseFloat(order.totalAmount);
            } else {
                console.warn('Invalid or missing totalAmount in order:', order);
            }
        });

        // Debug logs
        console.log('Total Amount:', totalAmount);
        console.log('Total Orders:', totalOrders);

        // Render the report
        res.render('customReport', {
            report: customDateReport,
            startDate: startDate.format('YYYY-MM-DD'),
            endDate: endDate.format('YYYY-MM-DD'),
            totalAmount: totalAmount.toFixed(2),
            totalOrders: totalOrders
        });
    } catch (error) {
        console.error('Error generating custom date report:', error);
        res.status(500).send('Error generating custom date report');
    }
};

const graphData = async (req, res) => {
    try {

        let salesData =
        {
            'labels': [],
            'salesData': [],
            'revenueData': [],
            'productsData': []
        }

        const { filter, time } = req.body

        if (filter === 'monthly') {
            salesData.labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const contraints = {
                $gte: new Date(`${time}-01-01T00:00:00.000Z`),
                $lte: new Date(`${time}-12-31T00:00:00.000Z`)
            }
            const sales = await Orders.aggregate([
                {
                    $match: {
                        createdAt: contraints
                    }
                },
                {
                    $group: {
                        _id: {
                            $month: '$createdAt'
                        },
                        revenueData: {
                            $sum: "$orderAmount"
                        },
                        salesData: {
                            $sum: 1
                        }
                    }
                },
                {
                    $sort: {
                        '_id': 1
                    }
                }
            ])
          
            const products = await Product.aggregate([
                {
                    $match: {
                        createdAt: contraints
                    }
                },
                {
                    $group: {
                        _id: {
                            $month: "$createdAt"
                        },
                        productsData: {
                            $sum: 1
                        }
                    }
                },
                {
                    $sort: {
                        "_id": 1 // Sort by month in ascending order
                    }
                }
            ])
      
            salesData.salesData = sales.map((item) => item.salesData)
            salesData.revenueData = sales.map((item) => item.revenueData / 1000);
            salesData.productsData = products.map((item) => item.productsData);
        } else {
          
            salesData.labels = [`${time - 10}, ${time - 9}, ${time - 8}, ${time - 7}, ${time - 6}, ${time - 5}, ${time - 4}, ${time - 3}, ${time - 2}, ${time - 1}, ${time}`];
            const contraints = {
                $gte: new Date(`${time - 10}-01-01T00:00:00.000Z`),
                $lte: new Date(`${time}-12-31T00:00:00.000Z`)
            }

            const sales = await Orders.aggregate([
                {
                    $match: {
                        createdAt: contraints
                    }
                },
                {
                    $group: {
                        _id: {
                            $year: "$createdAt"
                        },
                        revenueData: {
                            $sum: "$orderAmount"
                        },
                        salesData: {
                            $sum: 1
                        }
                    }
                },
                {
                    $sort: {
                        "_id": 1
                    }
                }
            ])
        
            const products = await Product.aggregate([
                {
                    $match: {
                        createdAt: contraints
                    }
                },
                {
                    $group: {
                        _id: {
                            $year: "$createdAt"
                        },
                        productsData: {
                            $sum: 1
                        }
                    }
                },
                {
                    $sort: {
                        "_id": 1
                    }
                }
            ])

          
            for (let key of sales) {
                
                for (let data of salesData.labels) {
                    
                    if (key._id == data) {
                        salesData.salesData.push(key.salesData)
                        salesData.revenueData.push(key.revenueData / 1000)
                    } else {
                        salesData.salesData.push(0)
                        salesData.revenueData.push(0)
                    }
                }
            }

            for (let key of products) {
              
                for(let data of  salesData.labels){
                  

                    if(key._id==data){
                        salesData.productsData.push(key.productsData) 
                    }else{
                        salesData.productsData.push(0)
                    }
                }

            }

        }
        res
        .status(200)
        .json(salesData)


    } catch (error) {
        console.log('error', error)
    }
}


module.exports={
    loadSalesReport,
    dailySalesReport,
    generateWeeklyReport,
    generateMonthlyReport,
    generateYearlyReport,
    generateCustomDateReport,
    graphData
}