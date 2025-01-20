const mongoose = require('mongoose');

const orderSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    deliveryAddress: {
        name: { type: String },
        streetAddress: { type: String },
        addressType: { type: String },
        city: { type: String },
        apartment: { type: String },
        landMark: { type: String },
        postalCode: { type: Number },
        phone: { type: String }
    },
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true
            },
            quantity: {
                type: Number,
                required: true
            },
            price: {
                type: Number,
                required: true
            }
        }
    ],
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['Wallet', 'Razorpay', 'COD'],
        required: true
    },
    orderStatus: {
        type: String,
        enum: [
            'Ordered', 
            'Shipped', 
            'Out For Delivery', 
            'Delivered', 
            'Cancelled', 
            'Return Pending',
            'Return Success',
            
           
        ],
        default: 'Ordered'
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    couponApplied: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
        default: null
    },
    offerApplied: {
        type: Number,
        default: 0
    },
    cancellationDetails: {
        type: String,
        enum: ['select option', 'Got at Better Price', 'Wrong Item Ordered', 'Shipping Time Too Long', 'Other Reason'],
        default: 'select option',
        description: String,
    },
    cancellationReason: {
        type: String,
        default: null
    },
    cancellationComment: {
        type: String,
        default: null
    },
    cancelDate: {
        type: String,
        default: null
    },
    returnDetails: {
        productId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Product' 
        },
        reason: { 
            type: String 
        },
        description: { 
            type: String 
        },
        requestedAt: { 
            type: Date, 
            default: Date.now 
        },
        status: { 
            type: String, 
            enum: ['Completed','Pending',], 
            default: 'Pending' 
        }
    }
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;