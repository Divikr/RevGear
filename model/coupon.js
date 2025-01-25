const mongoose = require('mongoose');

const couponSchema = mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
    },
    offerType: {
        type: String,
        enum: ['Percentage', 'flat'],
        required: true,
    },
    offerValue: {
        type: Number,
        required: true,
    },
    minimumPrice: {
        type: Number,
        required: true,
    },
    createdOn: {
        type: Date,
        default: Date.now,
    },
    expiredOn: {
        type: Date,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    usageLimit: {
        type: Number,
        default: null,
    },
    usagePerUserLimit: {
        type: Number,
        default: 1,
    },
    couponUsed: {
        type: Number,
        default: 0,
    },
    description: {
        type: String,
        default: '',
    },
    isdelete: {
        type: Boolean,
        default: false,
    },
    status:{
        type:Boolean,
        default:true,
    },
 
});

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
