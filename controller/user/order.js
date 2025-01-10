const User = require("../../model/users");
const Category = require('../../model/category');
const Product = require('../../model/product')
const Wishlist = require("../../model/wishlist"); 
const Cart = require("../../model/cart"); 
const Address = require('../../model/address');
const Wallet = require('../../model/wallet');
const Order = require('../../model/Order');
const Coupon = require('../../model/coupon');
const mongoose = require("mongoose"); 
const path = require("path");

const orderconfirm = async (req, res) => {
    try {
        const {id} = req.params;
        const userId = req.session.user;
      
        await Cart.findOneAndUpdate(
          { userId },
          { $set: { items: [] } }
        );
  ;
        const order = await Order.findById({_id:id});
        res.render("user/orderConfirmation", {order});
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
  };





  const orderdetails = async (req, res) => {
    try {
        const {id} = req.params;
        const order = await Order.findById({_id: id}).populate("items.productId");
        res.render("user/orderDetails",{order});
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
  };



  
const orderlist = async (req, res) => {
    try {
       const id=req.session.user._id;
       
       const orders=await Order.find({userId:id})
       console.log(orders)
      
        res.render("user/orderList",{orders});
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
  };
  
  const cancelOrder = async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, description } = req.body;
  
      // Find the order by ID
      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }
  
      // Check if the order can be cancelled
      if (!['Ordered'].includes(order.orderStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Order cannot be cancelled at this stage',
        });
      }
  
      // Update order status to 'Cancelled'
      order.orderStatus = 'Cancelled';
      order.cancellationDetails = reason;
      order.cancellationReason = reason;
      order.cancellationComment = description;
      order.cancelDate = new Date().toISOString();
  
      // Restock the product quantities
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        } else {
          return res.status(404).json({
            success: false,
            message: `Product with ID ${item.productId} not found`,
          });
        }
      }
  
      // Save the cancelled order
      await order.save();
  
      // Credit the amount to the user's wallet
      const wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'User wallet not found',
        });
      }
  
      // Create a new transaction for the wallet
      wallet.transactions.push({
        amount: order.totalAmount,
        type: 'credit',
        date: new Date(),
      });
  
      // Update the wallet balance
      wallet.balance += order.totalAmount;
  
      // Save the updated wallet
      await wallet.save();
  
      res.json({
        success: true,
        message: 'Order cancelled successfully, amount credited to wallet, and stock updated',
        order,
        wallet,
      });
    } catch (error) {
      console.error('Cancel order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel order',
        error: error.message,
      });
    }
  };
  
  


  
  const placeOrder = async (req, res) => {
    try {
        const { savedaddress, paymentMethod, cart, couponCode } = req.body; // Include couponCode in the request body
        const userId = req.session.user;
        console.log("Received order details:", { savedaddress, paymentMethod, cart, couponCode });

        if (!savedaddress || !paymentMethod || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid order details.' });
        }

        const address = await Address.findById({ _id: savedaddress });

        let totalAmount = 0;
        const items = cart.map(item => {
            if (!item.productId || !item.productId.salePrice || !item.quantity) {
                throw new Error('Invalid item in cart.');
            }

            const itemTotal = item.productId.salePrice * item.quantity;
            totalAmount += itemTotal;

            return {
                productId: item.productId._id,
                quantity: item.quantity,
                price: item.productId.salePrice
            };
        });

        // If a coupon code is provided, check if it is valid
        let discount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode, isActive: true, status: true });
            if (coupon && coupon.status === true) {
                // Calculate the discount
                if (coupon.offerType === 'Percentage') {
                    discount = (coupon.offerValue / 100) * totalAmount;
                } else if (coupon.offerType === 'flat') {
                    discount = coupon.offerValue;
                }
                totalAmount = Math.max(totalAmount - discount, 0);
            }
        }

        console.log("Total amount after discount:", totalAmount);

        const newOrder = new Order({
            userId,
            deliveryAddress: address,
            items,
            totalAmount,
            paymentMethod,
            couponApplied: couponCode ? Coupon._id : null, // Save the coupon ID to the order
            offerApplied: discount // Save the discount applied
        });

        console.log("Saving order:", newOrder);

        const savedOrder = await newOrder.save();

        console.log("Order saved:", savedOrder);

        for (const item of items) {
            const updatedProduct = await Product.findOneAndUpdate(
                { _id: item.productId },
                { $inc: { quantity: -item.quantity } },
                { new: true }
            );

            if (updatedProduct && updatedProduct.quantity === 0) {
                await Product.findByIdAndUpdate(item.productId, {
                    status: "Out of Stock",
                });
            }
        }

        res.status(201).json({ success: true, message: 'Order placed successfully!', orderId: savedOrder._id });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ success: false, message: 'An error occurred while placing the order.' });
    }
};




   const getCheckout = async (req, res) => {
    try {
      const user = req.session.user; 
      const userId = user._id; 
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).send('Invalid User ID');
      }
  
  
      const cart = await Cart.findOne({ userId }).populate('items.productId'); 
  
      const savedAddresses = await Address.find({ userId });
  
      const total = cart.items.reduce((sum, item) => sum + item.productId.salePrice * item.quantity, 0);
  
      res.render('user/checkout', { cart: cart.items, savedAddresses, total });
    } catch (error) {
      console.error('Error in checkout:', error.message);
      res.status(500).send('Server error');
    }
  };



  
  const returnOrder = async (req, res) => {
    try {
        console.log("Processing return request for order");

        // Extract orderId, reason, and description from the request body
        const { orderId, reason, description } = req.body;

        console.log("Request Data:", req.body);

        // Validate required fields
        if (!orderId || !reason || !description) {
            return res.status(400).json({ message: 'Order ID, reason, and description are required.' });
        }

        // Find the order by its ID
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Check if the order status allows a return
        if (order.orderStatus !== 'Delivered') {
            return res.status(400).json({ message: 'Return is only allowed for delivered orders.' });
        }

        // Update the return details
        order.returnDetails = {
            reason,
            description,
            requestedAt: new Date(),
            status: 'Pending', // Set the return status to "Pending"
        };

        // Update the order status to "Return Pending"
        order.orderStatus = 'Return Pending';

        // Save the updated order to the database
        const updatedOrder = await order.save();

        console.log("Return request processed successfully:", updatedOrder);

        // Return a success response with updated order details
        return res.status(200).json({
            message: 'Return request submitted successfully.',
            data: updatedOrder,
        });
    } catch (error) {
        console.error('Error processing return order:', error);
        return res.status(500).json({ message: 'An error occurred. Please try again later.' });
    }
};


   



   module.exports={
    orderconfirm,
    orderdetails,
    placeOrder,
    orderlist,
    cancelOrder,
    getCheckout,
    returnOrder,
   
   }