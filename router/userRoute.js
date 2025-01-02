const express = require("express")
const route = express()
const userController = require("../controller/user/userController")
const productController = require("../controller/user/productController")
const profileController = require("../controller/user/profile")
const paymentController = require("../controller/user/payment")
const passport = require("../config/passport");
const auth = require("../middleware/userAuth")

route.get("/", auth.islogin, userController.homePage)

route.get("/signup", userController.loadsignup)
route.post("/signup", userController.signup)


route.get("/otp", userController.otp)


route.post("/otpPost", userController.otpPost)
route.post("/resendotp", userController.resendOtp)

route.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))


route.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
route.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }),
  (req, res) => {
    res.redirect("/home");
  }
);


route.get("/login", userController.loadlogin)
route.post("/login", userController.login)


route.get("/forgetPassword",userController.getForget)
route.post("/forgetPassword",userController.postForget)

route.get("/otpforget", userController.otpforget)
route.post('/otpforget',userController.verifyPasswordOtp)

route.get('/setPassword',userController.setPassword)
route.post("/resendOtp", userController.resendotp)
route.post("/setPassword",userController.setNewPassword)



route.get("/home", userController.home)
route.get("/logout", userController.logout)



//product manegment

route.get("/product", userController.getAllProducts);

route.get('/product/:id', productController.singleproduct)

route.get('/categories', userController.category);

route.get("/products",userController.getAllProducts)



route.get('/search', userController.searchProducts);

route.get('/products/:name', productController.getProductByCategory)





//profile  managment

route.get('/profile',profileController.profile)
route.post('/edit-profile', profileController.editProfile);

route.get('/addressbook',profileController.addressBook)
route.post('/addressbook',profileController.loadAddressBook)

route.get('/addaddress',profileController.addAddress)
route.post('/addaddress',profileController.addressverify)

route.post('/add-address-checkout', profileController.addAddressFromCheckout);

route.delete('/deleteAddress/:id',profileController.deleteAddress)

route.get('/editaddress',profileController.getEditAddress)
route.post('/editaddress/:id',profileController.editAddress)

route.get('/changePassword',profileController.getpassword)
route.post('/changePassword',profileController.postpassword)


//cart manegment

route.post('/addToCart', productController.addToCart);
route.get('/cart',productController.getcart)
route.delete('/wishlist/remove/:productId', productController.removeFromWishlist);
route.delete('/cart/remove/:productId', productController.removeFromCart);
route.get('/checkout',productController.getCheckout);
route.post('/update', productController.updateCart);


//wishlist manegment

route.post('/wishlist/add', productController.addToWishlist);
route.get('/wishlist',productController.getwishlist);




//order manegment

route.post('/place-order', productController.placeOrder)
route.get('/orderconfirm/:id',productController.orderconfirm);

route.get('/myorder/:id', productController.orderdetails)

route.get('/orderlist',productController.orderlist);

route.post('/orders/cancel/:id',productController.cancelOrder);


//payment

route.post('/create-razorpay-order',paymentController.createRazorpayOrder);







module.exports = route