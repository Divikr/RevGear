const Cart = require("../../model/cart"); 
const User = require("../../model/users");
const Address = require('../../model/address');
const Order = require('../../model/Order');
const Wallet = require('../../model/wallet');
const env = require("dotenv").config();
const mongoose = require("mongoose"); 
const Razorpay = require('razorpay');
const crypto=require("crypto")

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrder = async (req, res) => {
    try {
        const { savedaddress, paymentMethod, cart } = req.body;

      
        console.log("Received order details:", { savedaddress, paymentMethod, cart });

        if (!savedaddress || !paymentMethod || !Array.isArray(cart) || cart.length === 0) {
            console.error('Invalid order details.');
            return res.status(400).json({ success: false, message: 'Invalid order details.' });
        }

       
        const totalAmount = cart.reduce((sum, item) => {
            if (!item.productId || !item.productId.salePrice || !item.quantity) {
                throw new Error('Invalid cart item structure.');
            }
            return sum + item.productId.salePrice * item.quantity;
        }, 0);

        console.log("Calculated total amount:", totalAmount);

        if (totalAmount <= 0) {
            console.error('Total amount is invalid.');
            return res.status(400).json({ success: false, message: 'Total amount must be greater than 0.' });
        }

       
        const options = {
            amount: totalAmount * 100, 
            currency: 'INR',
            receipt: `order_rcptid_${Math.floor(Math.random() * 1000000)}`,
        };

        console.log("Creating Razorpay order with options:", options);

        const order = await razorpay.orders.create(options);

        console.log("Razorpay order created successfully:", order);

        res.status(200).json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);

        if (error.isAxiosError) {
            console.error('Razorpay API error:', error.response.data);
        }

        res.status(500).json({ success: false, message: 'Failed to create Razorpay order.' });
    }
};

  
  
const getWallet =  async (req, res) => {
    try {
        const userId = req.session.user;
        console.log("................", userId);

        
        const user = await User.findById(userId);
        if (!userId) {
            return res.status(401).send("User not authenticated");
        }
        console.log("-------->", user.name);
        
       
        let wallet = await Wallet.findOne({ userId: userId });


        if (!wallet) {
            wallet = new Wallet({
                userId: userId,
                balance: 0,
                transactions: []
            });
            await wallet.save();
        }

   
        res.render("user/wallet", { 
            wallet, 
            userName: user.name
        });
        
    } catch (error) {
        console.error("Error fetching wallet details:", error);
        res.status(500).send("Internal Server Error");
    }
};

const paymentWallet = async (req, res) => {
    try {
        console.log('Received request body:', req.body); // Debug log

        const {  amount, orderId } = req.body;

        // Debug log for extracted values
        console.log('Extracted values:', {  amount, orderId });

        // Detailed validation with specific error messages
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID is required.' 
            });
        }

        if (!amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Amount is required.' 
            });
        }

        if (!orderId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Order ID is required.' 
            });
        }

        // Fetch the user's wallet
        const wallet = await Wallet.findOne({ userId: user });
        console.log('Found wallet:', wallet); // Debug log

        if (!wallet) {
            return res.status(404).json({ 
                success: false, 
                message: 'Wallet not found.' 
            });
        }

        // Check if the wallet has enough balance
        if (wallet.balance < amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Insufficient wallet balance.' 
            });
        }

        // Deduct the amount from the wallet
        wallet.balance -= amount;
        wallet.transactions.push({
            amount,
            type: 'debit',
            orderId, // Optional: store orderId in transaction for reference
            timestamp: new Date()
        });
        await wallet.save();

        // Mark the order as paid
        const order = await Order.findById(orderId);
        if (!order) {
            // Rollback wallet transaction if order not found
            wallet.balance += amount;
            wallet.transactions.pop();
            await wallet.save();
            
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found.' 
            });
        }

        order.paymentStatus = 'Paid';
        order.paymentMethod = 'Wallet';
        await order.save();

        return res.status(200).json({ 
            success: true, 
            message: 'Payment successful.', 
            balance: wallet.balance,
            orderId: order._id
        });
    } catch (error) {
        console.error('Error processing wallet payment:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'An error occurred while processing the payment.' 
        });
    }
};

  module.exports={
    createRazorpayOrder,
    getWallet,
    paymentWallet
    
  }