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

        // Validate cart existence and content
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Your cart is empty.' });
        }

        // Fetch coupon details
        const coupon = await Coupon.findOne({ code: voucherCode, isActive: true });
        if (!coupon) {
            return res.status(400).json({ message: 'Invalid or expired coupon code.' });
        }

        // Check if coupon is expired
        if (new Date() > coupon.expiredOn) {
            return res.status(400).json({ message: 'This coupon has expired.' });
        }

        // Check if user has already used the coupon
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

        // Check coupon usage limit
        if (coupon.usageLimit && coupon.couponUsed >= coupon.usageLimit) {
            return res.status(400).json({ message: 'Coupon usage limit reached.' });
        }

        // Calculate cart total
        const cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        // Verify minimum price requirement
        if (cartTotal < coupon.minimumPrice) {
            return res.status(400).json({ 
                message: `A minimum purchase of $${coupon.minimumPrice} is required to use this coupon.` 
            });
        }

        // Calculate discount
        let discount = 0;
        if (coupon.offerType === 'Percentage') {
            discount = (coupon.offerValue / 100) * cartTotal;
        } else if (coupon.offerType === 'flat') {
            discount = coupon.offerValue;
        }

        // Ensure discount doesn't exceed cart total
        const discountedTotal = Math.max(cartTotal - discount, 0);

        // Update coupon usage
        coupon.couponUsed += 1;
        await coupon.save();

        // Update user's used coupons
        user.couponUsed = user.couponUsed || []; // Initialize if undefined
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

module.exports = {
    applyCoupon,
};
