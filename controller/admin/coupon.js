const Coupon = require("../../model/coupon");
const Cart = require("../../model/cart");
const User = require("../../model/users");

const getCoupon = async (req,res) => {
    try {
        const coupons = await Coupon.find({});
        console.log("...................",{coupons})
        res.render('coupon',{coupons})
    } catch (error) {
        console.error('Error loading coupon page:', error);
        res.status(500).send('Error loading coupon page');
    }
}




const addCoupon = async (req, res) => {
    try {

        console.log(".................................")
        const { code, offerType, offerValue, minimumPrice, createdOn, expiredOn, usageLimit, usagePerUserLimit, isActive } = req.body;



        if (!code || !offerType || !offerValue || !minimumPrice || !expiredOn) {
            return res.status(400).json({ success: false, message: "All required fields must be filled" });
        }

        if (offerType === 'Percentage' && (offerValue <= 0 || offerValue > 100)) {
            return res.status(400).json({ success: false, message: "Percentage discount must be between 1 and 100" });
        }

        const existingCoupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "Coupon code already exists" });
        }

        const newCoupon = new Coupon({
            code: code.trim().toUpperCase(),
            offerType,
            offerValue,
            minimumPrice,
            createdOn: createdOn || new Date(),
            expiredOn,
            usageLimit: usageLimit || null,
            usagePerUserLimit: usagePerUserLimit || 1,
            isActive: isActive ?? true,
           
        });

        const savedCoupon = await newCoupon.save();
        return res.status(201).json({ success: true, message: "Coupon added successfully", coupon: savedCoupon });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
    }
};






module.exports={
    getCoupon,
    addCoupon,
    
}