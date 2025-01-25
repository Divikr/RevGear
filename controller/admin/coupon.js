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
        const { code, offerType, offerValue, minimumPrice, createdOn, expiredOn, usageLimit, usagePerUserLimit, isActive, status } = req.body;



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
            expiredOn:new Date(expiredOn),
            usageLimit: usageLimit || null,
            usagePerUserLimit: usagePerUserLimit || 1,
            isActive: isActive ?? true,
            status:true
            
           
        });

        const savedCoupon = await newCoupon.save();
        return res.status(201).json({ success: true, message: "Coupon added successfully", coupon: savedCoupon });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
    }
};

const  deleteCoupon = async (req, res) => {
    try {
        const { code } = req.params;

   
        if (!code) {
            return res.status(400).json({ success: false, message: "Coupon code is required" });
        }


        const deletedCoupon = await Coupon.findOneAndDelete({ code });

        if (!deletedCoupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        res.status(200).json({ success: true, message: "Coupon deleted successfully" });
    } catch (error) {
        console.error("Error deleting coupon by code:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const checkExpiredCoupons = async () => {
    try {
        const now = new Date();
        console.log("Checking expired coupons. Current date:", now);

        const expiredCoupons = await Coupon.updateMany(
            { 
                expiredOn: { $lt: now }, 
                status: true 
            },
            { 
                $set: { 
                    status: false, 
                    isActive: false 
                } 
            }
        );

        console.log(`${expiredCoupons.modifiedCount} coupons expired and deactivated.`);
    } catch (error) {
        console.error("Error updating expired coupons:", error);
    }
};

setInterval(checkExpiredCoupons, 24 * 60 * 60 * 1000);

module.exports={
    getCoupon,
    addCoupon,
    deleteCoupon 
    
}