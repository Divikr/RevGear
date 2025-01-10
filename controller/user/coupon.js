const Coupon = require("../../model/coupon");
const Cart = require("../../model/cart");
const User = require("../../model/users");

const applyCoupon = async (req, res, next) => {
    try {
        const { voucherCode } = req.body;
        const userId = req.session.user;

        if (!voucherCode) {
            return res.status(400).json({ message: 'Voucher code is required.' });
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Your cart is empty.' });
        }

   
        const coupon = await Coupon.findOne({ code: voucherCode, isActive: true  });
        if (!coupon) {
            return res.status(400).json({ message: 'Invalid or expired coupon code.' });
        }

      
        if (new Date() > coupon.expiredOn) {
            return res.status(400).json({ message: 'This coupon has expired.' });
        }

        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'User not found.' });
        }

        const hasUsedCoupon = (user.couponUsed || []).some(
            (usedCoupon) => usedCoupon.toString() === coupon._id.toString()
        );
        if (hasUsedCoupon && coupon.usagePerUserLimit <= 1) {
            return res.status(400).json({ message: 'You have already used this coupon.' });
        }

     
        if (coupon.usageLimit && coupon.couponUsed >= coupon.usageLimit) {
            return res.status(400).json({ message: 'Coupon usage limit reached.' });
        }

       
        const cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        if (cartTotal < coupon.minimumPrice) {
            return res.status(400).json({ 
                message: `A minimum purchase of $${coupon.minimumPrice} is required to use this coupon.` 
            });
        }

     
        let discount = 0;
        if (coupon.offerType === 'Percentage') {
            discount = (coupon.offerValue / 100) * cartTotal;
        } else if (coupon.offerType === 'flat') {
            discount = coupon.offerValue;
        }

        const discountedTotal = Math.max(cartTotal - discount, 0);
        
    
        coupon.couponUsed += 1;
        await coupon.save();

     
        user.couponUsed = user.couponUsed || []; 
        user.couponUsed.push(coupon._id);
        await user.save();

        return res.status(200).json({
            message: 'Coupon applied successfully.',
            discount,
            discountedTotal,
        });
    } catch (error) {
        console.error('Error in applyCoupon:', error);
        next(error);
    }
};



const getCoupon=async (req, res) => {
    try {
        const coupons = await Coupon.find({ isActive: true, isdelete: false });
        res.status(200).json(coupons);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching coupons', error });
    }
};


module.exports = {
    applyCoupon,
    getCoupon
};
