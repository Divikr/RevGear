const Coupon = require("../../model/coupon");
const Cart = require("../../model/cart");
const User = require("../../model/users");

const applyCoupon = async (req, res, next) => {
    try {
        const { voucherCode } = req.body;
        const userId = req.session.user;
        const currentDate = new Date();

        if (!voucherCode) {
            return res.status(400).json({ message: 'Voucher code is required.' });
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Your cart is empty.' });
        }

        const coupon = await Coupon.findOne({ 
            code: voucherCode, 
            isActive: true,
            status: true,
            isdelete: false,
            expiredOn: { $gt: currentDate },
            createdOn: { $lte: currentDate }
        });

        if (!coupon) {
            return res.status(400).json({ message: 'Invalid or expired coupon code.' });
        }

    
        const expiryDate = new Date(coupon.expiredOn);
        const startDate = new Date(coupon.createdOn);

        if (currentDate < startDate) {
            return res.status(400).json({ 
                message: `This coupon is not valid yet. It will be active from ${startDate.toLocaleDateString()}.` 
            });
        }

        if (currentDate > expiryDate) {
            return res.status(400).json({ 
                message: `This coupon expired on ${expiryDate.toLocaleDateString()}.` 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'User not found.' });
        }

        const hasUsedCoupon = (user.couponUsed || []).some(
            (usedCoupon) => usedCoupon.toString() === coupon._id.toString()
        );
        
        if (hasUsedCoupon) {
            const userUsageCount = user.couponUsed.filter(
                (usedCoupon) => usedCoupon.toString() === coupon._id.toString()
            ).length;
            
            if (userUsageCount >= coupon.usagePerUserLimit) {
                return res.status(400).json({ 
                    message: `You have reached the maximum usage limit (${coupon.usagePerUserLimit}) for this coupon.` 
                });
            }
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

   
        if (!user.couponUsed) {
            user.couponUsed = [];
        }
        user.couponUsed.push(coupon._id);
        await user.save();

        return res.status(200).json({
            message: 'Coupon applied successfully.',
            discount,
            discountedTotal,
            expiresOn: expiryDate.toLocaleDateString()
        });
    } catch (error) {
        console.error('Error in applyCoupon:', error);
        next(error);
    }
};



const getCoupon=async (req, res) => {
    try {
        const coupons = await Coupon.find({ isActive: true, isdelete: false ,status:true});
        res.status(200).json(coupons);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching coupons', error });
    }
};


module.exports = {
    applyCoupon,
    getCoupon
};
