const Cart = require("../../model/cart"); 
const User = require("../../model/users");
const Address = require('../../model/address');
const Order = require('../../model/Order');
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

        // Log received data for debugging
        console.log("Received order details:", { savedaddress, paymentMethod, cart });

        if (!savedaddress || !paymentMethod || !Array.isArray(cart) || cart.length === 0) {
            console.error('Invalid order details.');
            return res.status(400).json({ success: false, message: 'Invalid order details.' });
        }

        // Calculate total amount
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

        // Create Razorpay order
        const options = {
            amount: totalAmount * 100, // Amount in paisa
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

  
  
  
 
  

  module.exports={
    createRazorpayOrder,
    
  }