const Coupon = require("../../model/coupon");
const Cart = require("../../model/cart");
const User = require("../../model/users");

const getCoupon = (req,res) => {
    try {
        res.render('coupon')
    } catch (error) {
        console.log(error.message)
    }
}

module.exports={
    getCoupon
}