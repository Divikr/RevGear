const User=require("../../model/users")
const mongoose=require("mongoose")
const Order=require("../../model/Order")
const Wallet=require("../../model/wallet")
const Coupon=require("../../model/coupon")
const Offer=require("../../model/offer")
const bcrypt=require("bcrypt")


//get admin

const adminloadlogin=(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("adminlogin")
}


//post admin

const adminlogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log(req.body)

     
        if (!email  ) {
            return res.status(400).render("adminlogin", { error: "All fields are required." });
        }

        if(!password){
            return res.status(400).render("adminlogin", { error: "All fields are required." }); 
        }



        const user = await User.findOne({ email });

        console.log(user)

      
        if (!user  ) {
            return res.status(401).render("adminlogin", { error: " Admin access only." });
        }

        if(!user.isAdmin){
            return res.status(401).render("adminlogin", { error: " Admin access only." }); 
        }
       
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).render("adminlogin", { error: "Invalid email or password." });
        }

        
        req.session.admin = {
            id: user._id,
            email: user.email,
        };
        res.redirect("/admin/dashboard");
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).render("login", { error: "Internal Server Error." });
    }
};


const getGraphData = async (timeRange) => {
    const now = new Date();
    let startDate;

    switch (timeRange) {
        case 'day':
            startDate = new Date(now.setDate(now.getDate() - 1));
            break;
        case 'week':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
        case 'month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
        case 'year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        default:
            startDate = new Date(now.setDate(now.getDate() - 1));
    }

    return await Order.aggregate([
        {
            $match: {
                orderDate: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$orderDate" }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};;




const dashboard = async (req, res) => {
    try {




        const totalRevenue = await Order.aggregate([
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);

        const totalOrders = await Order.countDocuments();
        const totalCoupons = await Coupon.countDocuments({ isdelete: false });
        const totalOffers = await Offer.countDocuments();
        const deliveredOrders = await Order.countDocuments({ orderStatus: 'Delivered' });
        const canceledOrders = await Order.countDocuments({ orderStatus: 'Cancelled' });
        const returnedOrders = await Order.countDocuments({ 'returnDetails.status': 'Completed' });

        const paymentMethodStats = await Order.aggregate([
            {
                $group: {
                    _id: "$paymentMethod",
                    count: { $sum: 1 }
                }
            }
        ]);
        const paymentMethodData = paymentMethodStats.map(method => ({
            method: method._id,
            count: method.count
        }));

        //

        const topProducts = await Order.aggregate([
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    totalQuantity: { $sum: "$items.quantity" }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $project: {
                    _id: 0,
                    productName: "$productDetails.productName",
                    totalQuantity: 1,

                    price: "$productDetails.price",
                    category: "$productDetails.category"
                }
            }
        ]);


        const recentOrders = await Order.aggregate([
            {
                $sort: { orderDate: -1 }
            },
            { $limit: 5 },

            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" },

            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            {
                $project: {
                    orderDate: 1,
                    totalAmount: 1,
                    orderStatus: 1,
                    paymentMethod: 1,
                    "userDetails.name": 1,
                    "deliveryAddress": 1,
                    items: {
                        $map: {
                            input: "$items",
                            as: "item",
                            in: {
                                quantity: "$$item.quantity",
                                price: "$$item.price",
                                product: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: "$productDetails",
                                                as: "prod",
                                                cond: { $eq: ["$$prod._id", "$$item.productId"] }
                                            }
                                        },
                                        0
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        ]);


        const topCategories = await Order.aggregate([
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: "$productDetails.category",
                    totalQuantitySold: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
                }
            },
            { $sort: { totalQuantitySold: -1 } },
            { $limit: 4 },
            {
                $project: {
                    category: "$_id",
                    totalQuantitySold: 1,
                    totalRevenue: { $round: ["$totalRevenue", 2] }
                }
            }
        ]);

        res.render("dashBoard", {
            totalRevenue: totalRevenue[0]?.total || 0,
            totalOrders,
            totalCoupons,
            totalOffers,
            paymentMethodData,
            deliveredOrders,
            canceledOrders,
            returnedOrders,
            topProducts,
            topCategories,
            recentOrders,
        });
    } catch (error) {
        console.error("Error rendering dashboard:", error);
        res.status(500).send("Server error");
    }
};

const fetchLineGraphData = async (req, res) => {
    try {
        const range = req.query.range || 'day'; 

        const aggregationPipeline = [];
        switch (range) {
            case 'day':
                aggregationPipeline.push({
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                        count: { $sum: 1 },
                    },
                });
                break;
            case 'week':
                aggregationPipeline.push(
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%U", date: "$orderDate" } }, 
                            count: { $sum: 1 },
                        },
                    }
                );
                break;
            case 'month':
                aggregationPipeline.push({
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
                        count: { $sum: 1 },
                    },
                });
                break;
            case 'year':
                aggregationPipeline.push({
                    $group: {
                        _id: { $year: "$orderDate" },
                        count: { $sum: 1 },
                    },
                });
                break;
        }

        aggregationPipeline.push({ $sort: { _id: 1 } }); 

        const orderGraphData = await Order.aggregate(aggregationPipeline).then(data =>
            data.map(item => ({
                label: item._id, 
                value: item.count,
            }))
        );

        res.status(200).json({ orderGraphData })
    } catch (error) {
        console.error("Error rendering dashboard:", error);
        res.status(500).send("Server error");
    }
}




//logout

const adminlogout=async (req,res)=>{
    try {
        req.session.destroy(err => {
            if(err){
                res.redirect("/admin/dashboard")
            }else{
                res.redirect("/admin/login")
            }
        })
    } catch (error) {
        console.log(error.message)
    }
} 


//get orderlist

const orderlists = async (req, res) => {
    try {
        const { page = 1, limit = 6 } = req.query; 

        const orders = await Order.find({})
            .populate('userId', 'name email')
            .populate('items.productId', 'name productImage')
            .sort({ orderDate: -1 })
            .limit(limit * 1) 
            .skip((page - 1) * limit); 

        const totalOrders = await Order.countDocuments(); 
        const totalPages = Math.ceil(totalOrders / limit); 

        res.render('orderLists', { 
            orders,
            totalPages,
            currentPage: parseInt(page, 10), 
            limit: parseInt(limit, 6)
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Failed to fetch orders" });
    }
};


//get viewOrder

const viewOrder = async (req, res) => {
    try {
        console.log("hello");
        const { orderId } = req.params;
        console.log("Order ID:", orderId);

       
        const orderDetails = await Order.findById(orderId)
            .populate('userId', 'name email mobile') 
            .populate('items.productId', 'productName price productImage'); 

        console.log("Order Details:", orderDetails);

        if (!orderDetails) {
            return res.status(404).send('Order not found');
        }

        res.render('viewOrderList', { orderDetails });
    } catch (error) {
        console.error('Error loading user single order:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

//post vieworder

const changeStatus=async(req,res)=>{

    const { orderId, status } = req.body;

    console.log("change sttus:",status)
    console.log("orderid:",orderId)
    
    if (!orderId || !status) {
        return res.status(400).json({ error: 'Order ID and status are required' });
    }

    try {
      
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { orderStatus: status },
            { new: true } 
        );

        if (!updatedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.status(200).json({
            message: 'Order status updated successfully',
            updatedOrder
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}


const approveReturn = async (req, res) => {
    try {
        const orderId = req.params.orderId; 
        const order = await Order.findById(orderId).populate('userId'); 

        if (!order) {
            return res.status(404).send('Order not found');
        }

       
        if (order.returnDetails.status !== 'Pending') {
            return res.status(400).send('Return status is not pending');
        }

       
        order.returnDetails.status = 'Completed';
        order.orderStatus = 'Return Success';

        
        const wallet = await Wallet.findOne({ userId: order.userId });

        if (!wallet) {
            return res.status(404).send('Wallet not found for user');
        }

       
        wallet.balance += order.totalAmount;
        wallet.transactions.push({
            amount: order.totalAmount,
            type: 'credit',
          
        });

       
        await wallet.save();
        await order.save();

        res.redirect(`/admin/viewOrderLists/${orderId}`); 
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};


const rejectReturn = async (req, res) => {
    try {
        const orderId = req.params.orderId; 
        const order = await Order.findById(orderId).populate('userId'); 

        if (!order) {
            return res.status(404).send('Order not found');
        }

        
        if (order.returnDetails.status !== 'Pending') {
            return res.status(400).send('Return status is not pending');
        }

        order.returnDetails.status = 'Reject';
        order.orderStatus = 'Return Reject';

      
        await order.save();

        res.redirect(`/admin/viewOrderLists/${orderId}`); 
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};


module.exports={
    adminloadlogin,
    adminlogin,
    dashboard,
    fetchLineGraphData,
    adminlogout,
    orderlists,
    viewOrder,
    changeStatus,
    approveReturn,
    rejectReturn
   
}