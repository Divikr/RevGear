const Category = require('../../model/category');
const User = require('../../model/users');
const Order = require('../../model/Order');
const moment = require('moment')
const PDFDocument = require('pdfkit');





const getSalesReport = async (req, res, next) => {
    try {
        const { startDate, endDate, timeFrame = 'daily' } = req.query;

        let matchCondition = { orderStatus: { $ne: 'Cancelled' } };
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (start > end) return res.status(400).json({ success: false, message: "End date must be after start date" });
            if (!isNaN(start) && !isNaN(end)) matchCondition.orderDate = { $gte: start, $lte: end };
            else return res.status(400).json({ success: false, message: "Invalid date format" });
        }

       
        const dateFormats = {
            daily: "%Y-%m-%d",
            weekly: "%Y-W%V",
            monthly: "%Y-%m",
            yearly: "%Y"
        };
        const dateFormat = { $dateToString: { format: dateFormats[timeFrame] || dateFormats.daily, date: "$orderDate" } };

        const salesData = await Order.aggregate([
            { $match: matchCondition },
            {
                $group: {
                    _id: dateFormat,
                    sales: { $sum: { $subtract: ["$totalAmount", "$offerApplied"] } },
                    orders: { $sum: 1 },
                    avgOrderValue: { $avg: { $subtract: ["$totalAmount", "$offerApplied"] } },
                    totalItems: {
                        $sum: {
                            $reduce: {
                                input: "$items",
                                initialValue: 0,
                                in: { $add: ["$$value", "$$this.quantity"] }
                            }
                        }
                    },
                    totalCouponsUsed: {
                        $sum: {
                            $cond: [
                                { $ne: ["$couponApplied", null] },
                                1,
                                0
                            ]
                        }
                    },
                    couponDeductions: { $sum: "$offerApplied" },
                    totalDiscounts: {
                        $sum: "$offerApplied"
                    },
                    grossRevenue: { $sum: "$totalAmount" },
                    netRevenue: {
                        $sum: {
                            $subtract: [
                                "$totalAmount",
                                "$offerApplied"
                            ]
                        }
                    }
                }
            },
            { $sort: { "_id": 1 } },
            {
                $project: {
                    date: "$_id",
                    sales: 1,
                    orders: 1,
                    avgOrderValue: { $round: ["$avgOrderValue", 2] },
                    totalItems: 1,
                    totalCouponsUsed: 1,
                    couponDeductions: { $round: ["$couponDeductions", 2] },
                    totalDiscounts: { $round: ["$totalDiscounts", 2] },
                    grossRevenue: { $round: ["$grossRevenue", 2] },
                    netRevenue: { $round: ["$netRevenue", 2] },
                    _id: 0
                }
            }
        ]);

        const summary = generateSummary(salesData);

        const paymentMethodStats = await Order.aggregate([
            { $match: matchCondition },
            {
                $group: {
                    _id: "$paymentMethod",
                    count: { $sum: 1 },
                    total: { $sum: "$totalAmount" }
                }
            }
        ]);

        res.json({
            success: true,
            data: { salesData, summary, paymentMethodStats }
        });

    } catch (error) {
        console.error('Sales Report Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating sales report',
            error: error.message
        });
        next(error);
    }
};

const generateSummary = (salesData) => {
    if (!salesData.length) return {
        totalSales: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        totalItems: 0,
        totalCouponsUsed: 0,
        couponDeductions: 0,
        totalDiscounts: 0,
        grossRevenue: 0,
        netRevenue: 0
    };

    return {
        totalSales: salesData.reduce((sum, item) => sum + item.sales, 0),
        totalOrders: salesData.reduce((sum, item) => sum + item.orders, 0),
        avgOrderValue: (salesData.reduce((sum, item) => sum + item.avgOrderValue, 0) / salesData.length).toFixed(2),
        totalItems: salesData.reduce((sum, item) => sum + item.totalItems, 0),
        totalCouponsUsed: salesData.reduce((sum, item) => sum + item.totalCouponsUsed, 0),
        couponDeductions: salesData.reduce((sum, item) => sum + item.couponDeductions, 0).toFixed(2),
        totalDiscounts: salesData.reduce((sum, item) => sum + item.totalDiscounts, 0).toFixed(2),
        grossRevenue: salesData.reduce((sum, item) => sum + item.grossRevenue, 0).toFixed(2),
        netRevenue: salesData.reduce((sum, item) => sum + item.netRevenue, 0).toFixed(2)
    };
};

const topSellers = async (req, res, next) => {
    try {
       
        const topProducts = await Order.aggregate([
            { $unwind: "$items" },
            { 
                $group: { 
                    _id: "$items.productId", 
                    value: { $sum: "$items.quantity" } 
                } 
            },
            {
                $lookup: {
                    from: "products",  
                    localField: "_id",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $project: {
                    name: "$productInfo.productName", 
                    value: 1,
                    _id: 0
                }
            },
            { $sort: { value: -1 } },
            { $limit: 5 }
        ]);

        const topCategories = await Order.aggregate([
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products", 
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $group: {
                    _id: "$productInfo.category", 
                    value: { $sum: "$items.quantity" }
                }
            },
            {
                $lookup: {
                    from: "categories", 
                    let: { categoryName: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$name", "$$categoryName"]  
                                }
                            }
                        }
                    ],
                    as: "categoryInfo"
                }
            },
            { $unwind: "$categoryInfo" },
            { 
                $project: {
                    name: "$categoryInfo.name",
                    value: 1,
                    _id: 0 
                }
            },
            { $sort: { value: -1 } },
            { $limit: 5 }
        ]);

        console.log(topCategories)

      
       

        res.json({
            success: true,
            products: topProducts,
            categories: topCategories,
           
        });
    } catch (error) {
        console.error('Error fetching top sellers:', error);
        res.status(500).json({ success: false, error: 'Error fetching top sellers' });
        next(error);
    }
};

module.exports = {
    getSalesReport,
    topSellers
};