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
const PDFDocument = require('pdfkit');

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
        const id = req.session.user._id;
        
        const page = parseInt(req.query.page) || 1;
        const limit = 6; 
        const skip = (page - 1) * limit;
        
        const orders = await Order.find({ userId: id })
                                  .skip(skip)
                                  .limit(limit)
                                  .sort({ orderDate: -1 });
        
        const totalOrders = await Order.countDocuments({ userId: id });
        const totalPages = Math.ceil(totalOrders / limit);
        
        res.render("user/orderList", { 
            orders,
            page,
            totalPages
        });
    } catch (error) {
        console.error("Error rendering order list:", error);
        res.status(500).send("Server error");
    }
};



  
  
  const cancelOrder = async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, description } = req.body;
  
      
      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }
  
     
      if (!['Ordered'].includes(order.orderStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Order cannot be cancelled at this stage',
        });
      }
  
      
      order.orderStatus = 'Cancelled';
      order.cancellationDetails = reason;
      order.cancellationReason = reason;
      order.cancellationComment = description;
      order.cancelDate = new Date().toISOString();
  
    
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
  
      
      await order.save();
  
     
      if (['Wallet', 'Razorpay'].includes(order.paymentMethod)) {
        const wallet = await Wallet.findOne({ userId: order.userId });
        if (!wallet) {
          return res.status(404).json({
            success: false,
            message: 'User wallet not found',
          });
        }
  
   
        wallet.transactions.push({
          amount: order.totalAmount-100,
          type: 'credit',
          date: new Date(),
        });
  
       
        wallet.balance += order.totalAmount-100;
  
      
        await wallet.save();
      }
  
      res.json({
        success: true,
        message: 'Order cancelled successfully. Stock updated and amount credited to wallet (if applicable).',
        order,
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
        const { savedaddress, paymentMethod, cart, couponCode } = req.body;
        const userId = req.session.user;
        const shippingCharge = 100; 

        console.log("payment", paymentMethod);
        console.log("Received order details:", { savedaddress, paymentMethod, cart, couponCode });

        if (!savedaddress || !paymentMethod || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid order details.' });
        }

        const address = await Address.findById({ _id: savedaddress });
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found.' });
        }

        let subtotal = 0;
        const items = [];

        for (const item of cart) {
            if (!item.productId || !item.productId.salePrice || !item.quantity) {
                return res.status(400).json({ success: false, message: 'Invalid item in cart.' });
            }

            const product = await Product.findById(item.productId._id);
            if (!product) {
                return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });
            }

            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Out of Stock`,
                });
            }

            const itemTotal = product.salePrice * item.quantity;
            subtotal += itemTotal;

            items.push({
                productId: product._id,
                quantity: item.quantity,
                price: product.salePrice,
            });
        }

        let discount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode, isActive: true, status: true });
            if (!coupon) {
                return res.status(400).json({ success: false, message: 'Invalid or inactive coupon.' });
            }

            const user = await User.findById(userId);
            if (user.couponUsed.includes(coupon._id)) {
                return res.status(400).json({ success: false, message: 'You have already used this coupon.' });
            }

            if (coupon.offerType === 'Percentage') {
                discount = (coupon.offerValue / 100) * subtotal;
            } else if (coupon.offerType === 'flat') {
                discount = coupon.offerValue;
            }

            coupon.couponUsed += 1;
            await coupon.save();

            user.couponUsed.push(coupon._id);
            await user.save();
        }

       
        const totalAmount = Math.max(subtotal - discount, 0) + shippingCharge;

        const validPaymentMethods = ['Wallet', 'Razorpay', 'COD'];
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({ error: "Invalid payment method" });
        }

        if (paymentMethod === "Wallet") {
            const wallet = await Wallet.findOne({ userId: req.session.user });
            if (!wallet) {
                return res.status(404).json({ error: "Wallet not found" });
            }

            if (wallet.balance < totalAmount) {
                return res.status(400).json({ error: "Insufficient wallet balance" });
            }

            wallet.balance -= totalAmount;
            wallet.transactions.push({
                amount: totalAmount,
                type: 'debit',
                description: 'Order Payment',
            });
            await wallet.save();
        }

        console.log("Total amount after discount and shipping:", totalAmount);

        const newOrder = new Order({
            userId,
            deliveryAddress: address,
            items,
            subtotal,
            shippingCharge,
            discount,
            totalAmount,
            paymentMethod,
            couponApplied: couponCode ? Coupon._id : null,
            offerApplied: discount,
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
  
 
    for (let item of cart.items) {
      if (item.quantity > item.productId.quantity) {
        return res.status(400).send('One or more items exceed available stock.');
      }
    }

    const total = cart.items.reduce((sum, item) => sum + item.productId.salePrice * item.quantity, 0);
    const disabledCOD=total>3000;

    res.render('user/checkout', { cart: cart.items, savedAddresses, total , offerApplied:0 , disabledCOD});
  } catch (error) {
    console.error('Error in checkout:', error.message);
    res.status(500).send('Server error');
  }
};




  
  const returnOrder = async (req, res) => {
    try {
        console.log("Processing return request for order");

        
        const { orderId, reason, description } = req.body;

        console.log("Request Data:", req.body);

        
        if (!orderId || !reason || !description) {
            return res.status(400).json({ message: 'Order ID, reason, and description are required.' });
        }

        
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        
        if (order.orderStatus !== 'Delivered') {
            return res.status(400).json({ message: 'Return is only allowed for delivered orders.' });
        }

        
        order.returnDetails = {
            reason,
            description,
            requestedAt: new Date(),
            status: 'Pending', 
        };

        
        order.orderStatus = 'Return Pending';

     
        const updatedOrder = await order.save();

        console.log("Return request processed successfully:", updatedOrder);

       
        return res.status(200).json({
            message: 'Return request submitted successfully.',
            data: updatedOrder,
        });
    } catch (error) {
        console.error('Error processing return order:', error);
        return res.status(500).json({ message: 'An error occurred. Please try again later.' });
    }
};

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId)
      .populate('items.productId', 'productName')
      .populate('couponApplied')
      .lean();

    if (!order) {
      return res.status(404).send('Order not found');
    }

    if (order.orderStatus !== 'Delivered') {
      return res.status(400).send('Invoice can only be downloaded for delivered orders.');
    }

    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      bufferPages: true
    });

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 100;
    const leftMargin = 50;
    const rightMargin = pageWidth - 50;
    const rightColumnStart = pageWidth / 2 + 20;

    const fileName = `revgear-invoice-${orderId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    doc.pipe(res);

    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingAmount = 100;
    let discountAmount = 0;
    let discountText = "No Coupon Applied";
    
    if (order.couponApplied) {
      if (order.couponApplied.offerType === 'percentage') {
        discountAmount = (order.couponApplied.offerValue / 100) * subtotal;
        discountText = `${order.couponApplied.offerValue}% Off (${order.couponApplied.couponCode})`;
      } else {
        discountAmount = order.couponApplied.offerValue;
        discountText = `₹${discountAmount} Off (${order.couponApplied.couponCode})`;
      }
    }


    doc
      .rect(0, 0, pageWidth, 160)
      .fill('#1a237e');

    doc
      .fontSize(32)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text('REVGEAR', leftMargin, 50)
      .fontSize(13)
      .font('Helvetica')
      .text('Your Ultimate Gear Destination', leftMargin, 90)
      .text('www.revgear.com | support@revgear.com', leftMargin, 110);

    doc
      .rect(rightMargin - 190, 40, 170, 100)
      .fill('#303f9f');

    doc
      .fillColor('#ffffff')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('INVOICE', rightMargin - 170, 55)
      .fontSize(11)
      .font('Helvetica')
      .text(`Invoice No: ${orderId}`, rightMargin - 170, 100)
      .text(`Date: ${new Date(order.orderDate).toLocaleDateString()}`, rightMargin - 170, 150);


    doc.y = 190;
    const addressY = doc.y;

    doc
      .fillColor('#000000')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('BILL TO', leftMargin, addressY)
      .moveDown(0.5)
      .fontSize(11)
      .font('Helvetica');

    const billingDetails = [
      order.deliveryAddress.name,
      order.deliveryAddress.phone,
      order.deliveryAddress.streetAddress,
      order.deliveryAddress.apartment && `Apt: ${order.deliveryAddress.apartment}`,
      order.deliveryAddress.landMark && `Landmark: ${order.deliveryAddress.landMark}`,
      `${order.deliveryAddress.city}${order.deliveryAddress.postalCode ? ` - ${order.deliveryAddress.postalCode}` : ''}`,
      `Address Type: ${order.deliveryAddress.addressType || 'Not specified'}`
    ].filter(Boolean);

    billingDetails.forEach(detail => {
      doc.text(detail, leftMargin, doc.y + 3);
      doc.moveDown(0.5);
    });

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('SHIP TO', rightColumnStart, addressY)
      .moveDown(0.5)
      .fontSize(11)
      .font('Helvetica');

    const shippingDetails = [
      order.deliveryAddress.name,
      order.deliveryAddress.streetAddress,
      order.deliveryAddress.apartment && `Apt: ${order.deliveryAddress.apartment}`,
      order.deliveryAddress.landMark && `Landmark: ${order.deliveryAddress.landMark}`,
      `${order.deliveryAddress.city}${order.deliveryAddress.postalCode ? ` - ${order.deliveryAddress.postalCode}` : ''}`,
      `Phone: ${order.deliveryAddress.phone}`
    ].filter(Boolean);

    shippingDetails.forEach(detail => {
      doc.text(detail, rightColumnStart, doc.y + 3);
      doc.moveDown(0.5);
    });

   
    doc.y += 50;
    const itemStart = doc.y;
    
   
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('ORDER DETAILS', leftMargin, itemStart - 30); 
    
    const columnPositions = {
      item: leftMargin + 10,
      qty: pageWidth - 260,
      price: pageWidth - 180,
      total: pageWidth - 100
    };

    
    doc
      .rect(leftMargin, itemStart - 10, contentWidth, 30)
      .fill('#f5f5f5');

    doc
      .fillColor('#000000')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('ITEM', columnPositions.item, itemStart)
      .text('QTY', columnPositions.qty, itemStart, { width: 50, align: 'right' })
      .text('PRICE', columnPositions.price, itemStart, { width: 70, align: 'right' })
      .text('TOTAL', columnPositions.total, itemStart, { width: 80, align: 'right' });

    let currentY = itemStart + 40;
    order.items.forEach((item, index) => {
      if (index % 2 === 0) {
        doc
          .rect(leftMargin, currentY - 10, contentWidth, 30)
          .fill('#fafafa');
      }

      doc
        .fillColor('#000000')
        .fontSize(10)
        .font('Helvetica')
        .text(item.productId.productName, columnPositions.item, currentY, { width: 250 })
        .text(item.quantity.toString(), columnPositions.qty, currentY, { width: 50, align: 'right' })
        .text(`₹${item.price.toFixed(2)}`, columnPositions.price, currentY, { width: 70, align: 'right' })
        .text(`₹${(item.price * item.quantity).toFixed(2)}`, columnPositions.total, currentY, { width: 80, align: 'right' });

      currentY += 40;
    });


    currentY += 20;
    const summaryWidth = 250;
    const summaryX = rightMargin - summaryWidth;

    doc
      .rect(summaryX, currentY, summaryWidth, 200)
      .fill('#f8f9fa');

    const summaryStartY = currentY + 15;
    const summaryLeftX = summaryX + 20;
    const summaryRightX = rightMargin - 20;

    doc
      .fillColor('#000000')
      .fontSize(11)
      .font('Helvetica')
      .text('Subtotal:', summaryLeftX, summaryStartY)
      .text(`₹${subtotal.toFixed(2)}`, summaryRightX - 80, summaryStartY, { width: 80, align: 'right' })
      .text('Shipping:', summaryLeftX, summaryStartY + 70)
      .text(`₹${shippingAmount.toFixed(2)}`, summaryRightX - 80, summaryStartY + 70, { width: 80, align: 'right' });

    doc
      .rect(summaryX, summaryStartY + 120, summaryWidth, 65)
      .fill('#1a237e');

    doc
      .fillColor('#ffffff')
      .fontSize(13)
      .font('Helvetica-Bold')
      .text('TOTAL AMOUNT:', summaryLeftX, summaryStartY + 140)
      .fontSize(16)
      .text(
        `₹${(subtotal - discountAmount + shippingAmount).toFixed(2)}`,
        summaryRightX - 100,
        summaryStartY + 140,
        { width: 100, align: 'right' }
      );

    doc
      .rect(0, doc.page.height - 40, pageWidth, 40)
      .fill('#f5f5f5');

    doc
      .fillColor('#666666')
      .fontSize(9)
      .font('Helvetica')
      .text(
        'RevGear Pvt. Ltd. | support@revgear.com | +91 9876543210',
        0,
        doc.page.height - 25,
        { align: 'center' }
      );

    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Unable to generate invoice');
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
    downloadInvoice,
   
   }