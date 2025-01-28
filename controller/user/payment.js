const Cart = require("../../model/cart"); 
const User = require("../../model/users");
const Address = require('../../model/address');
const Order = require('../../model/Order');
const Product = require('../../model/product');
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
        console.log('.......fgsegg....',order)

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


const handlePaymentFailure = async (req, res) => {
    try {
      const {
        savedaddress,
        cart,
        couponCode,
        discount,
        finalTotal,
        paymentFailureDetails
      } = req.body;
  
      console.log("Received payment failure data:", req.body);
  
      if (!savedaddress || !cart || !finalTotal) {
        throw new Error('Missing required order details');
      }
  
      const userId = req.session.user;
      const address = await Address.findById(savedaddress);
      
console.log("address........",address)

      if (!address) {
        throw new Error('Delivery address not found');
      }
  
      for (const item of cart) {
        const product = await Product.findById(item.productId._id);
        if (!product) {
          throw new Error(`Product not found for ID: ${item.productId._id}`);
        }
        if (product.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product: ${product.productName}`);
        }
      }

      const items = cart.map(item => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.salePrice
      }));
  
console.log("items......",items)

      const newOrder = new Order({
        userId,
        deliveryAddress: {
          name: address.name,
          streetAddress: address.street,
          addressType: address.addressType,
          city: address.city,
          apartment: address.apartment,
          landMark: address.landmark,
          postalCode: address.postalCode,
          phone: address.phone
        },
        items,
        totalAmount: finalTotal,
        paymentMethod: 'Razorpay',
        orderStatus: 'Payment Pending',
        paymentDetails: paymentFailureDetails
      });
  console.log("newOrder......",newOrder)

      const savedOrder = await newOrder.save();

      console.log("savedorder.........",savedOrder)
      
      res.status(201).json({
        success: true,
        message: 'Order created with pending payment status',
        orderId: savedOrder._id
      });
  
    } catch (error) {
      console.error('Payment failure handling error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process failed payment'
      });
    }
  };

  const retryPayment = async (req, res) => {
    try {
      const { orderId } = req.params;
      console.log("order", orderId);
  
   
      const order = await Order.findById(orderId);
  
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
  
      if (order.orderStatus !== 'Payment Pending') {
        return res.status(400).json({
          success: false,
          message: 'Payment can only be retried for orders with status "Payment Pending"',
        });
      }

     
  
  
      const razorpayOrder = await razorpay.orders.create({
        amount: order.totalAmount * 100, 
        currency: 'INR',
        receipt: `order_${order._id}`,
        notes: {
          userId: order.userId.toString(),
          orderId: order._id.toString(),
        },
      });
  
    
      res.status(200).json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID,
        razorpayOrderId: razorpayOrder.id,
        amount: order.totalAmount * 100,
        currency: 'INR',
      });
    } catch (error) {
      console.error('Error in retrying payment:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'An error occurred while retrying payment',
      });
    }
  };
  

  const paymentSuccess = async (req, res) => {
    try {
      const { 
        razorpay_payment_id, 
        razorpay_order_id, 
        razorpay_signature,
        orderId 
      } = req.body;
  
   
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ 
          success: false, 
          message: 'Order not found' 
        });
      }
  
   
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
  
      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid payment signature' 
        });
      }
  
     
      order.orderStatus = 'Ordered';
      order.paymentDetails = {
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        status: 'success'
      };
  
      await order.save();
  
      return res.status(200).json({ 
        success: true, 
        message: 'Payment successful',
        orderId: order._id 
      });
    } catch (error) {
      console.error('Payment success error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Payment processing failed' 
      });
    }
  };


  const paymentFailed = async (req, res) => {
    try {
        const { orderId } = req.params;
       

        

        const order = await Order.findById(orderId);
        
       

        res.render('user/paymentFailed', { order });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Something went wrong');
    }
};

  module.exports={
    createRazorpayOrder,
    getWallet,
    handlePaymentFailure,
    paymentFailed,
    retryPayment,
    paymentSuccess 
  }