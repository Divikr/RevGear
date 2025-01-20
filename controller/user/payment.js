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
        const { finalTotal,savedaddress, paymentMethod, cart } = req.body;
console.log(req.body)
      
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
            amount: (finalTotal.toFixed(2)) * 100, 
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

  
const getWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log("................", userId);

        if (!userId) {
            return res.status(401).send("User not authenticated");
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send("User not found");
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

        
        wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.render("user/wallet", { 
            wallet, 
            userName: user.name
        });

    } catch (error) {
        console.error("Error fetching wallet details:", error);
        res.status(500).send("Internal Server Error");
    }
};


const paymentFailed = (req, res) => {
    try {
      res.render('user/paymentFailed');
    } catch (error) {
      console.log(error.message);
    }
  };


  module.exports={
    createRazorpayOrder,
    getWallet,
    paymentFailed
    
    
  }