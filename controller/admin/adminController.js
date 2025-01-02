const User=require("../../model/users")
const mongoose=require("mongoose")
const Order=require("../../model/Order")
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

//get dashboard

const dashboard = async (req, res) => {
    try {
        res.render("dashBoard", {
            admin: req.session.admin, 
        });
    } catch (error) {
        console.error("Error rendering dashboard:", error);
        res.status(500).send("Server error");
    }
};


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

module.exports={
    adminloadlogin,
    adminlogin,
    dashboard,
    adminlogout,
    orderlists,
    viewOrder,
    changeStatus
   
}