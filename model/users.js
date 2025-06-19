const mongoose = require('mongoose');
const {Schema}=mongoose;

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
     
        sparse: true, 
        
    },
    password: {
        type: String,
        required: false 
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true 
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    couponUsed:[{
        type:Schema.Types.ObjectId,
        ref:"Coupon"
    }]
  
});

const User = mongoose.model('User', userSchema);

module.exports = User;
