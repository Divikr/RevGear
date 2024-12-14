const mongoose = require('mongoose');

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
        unique: true,
        sparse: true, 
        default: null
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
    }
  

});

const User = mongoose.model('User', userSchema);

module.exports = User;
