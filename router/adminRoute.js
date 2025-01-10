const express = require("express")
const router = express.Router()
const adminController = require("../controller/admin/adminController")
const customerController = require("../controller/admin/customer")
const categoryController = require("../controller/admin/category")
const productController = require('../controller/admin/product')
const couponController = require('../controller/admin/coupon')
const auth = require("../middleware/adminAuth")
const multer = require('multer')

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

router.get("/login", adminController.adminloadlogin)
router.post("/login", adminController.adminlogin)

router.get("/dashboard", auth.isAdminAuth, adminController.dashboard)

router.get("/adminlogout", adminController.adminlogout)


//customers managment

router.get("/customerInfo", auth.isAdminAuth, customerController.customerInfo);
router.get('/customer', auth.isAdminAuth, customerController.customerInfo)
router.get("/toggleCustomerBlock", auth.isAdminAuth, customerController.toggleCustomerBlock);


//category manegment

router.get("/category", auth.isAdminAuth, categoryController.getCategory)
router.get('/addcategory', auth.isAdminAuth, categoryController.addCategory)
router.post('/addcategory',upload.array("Image", 1), categoryController.addCategorys)
router.get('/listToggle', auth.isAdminAuth, categoryController.toggleCategoryStatus)
router.get('/editcategory/:id', auth.isAdminAuth, categoryController.editCategory)
router.post('/editcategory/:id',upload.single('Image'), categoryController.editsCategory)

//product manegment

router.get("/product", auth.isAdminAuth, productController.getProduct)
router.get('/addproduct', auth.isAdminAuth, productController.addproduct)
router.post("/addproduct", upload.array("productImage", 4), productController.addProduct);
router.get('/editProduct/:id',auth.isAdminAuth, productController.editProduct)
router.post('/editProduct/:id', upload.array("productImage", 4), productController.updateProduct)
router.get('/blockProduct/:id',auth.isAdminAuth, productController.blockProduct)

//order manegment

router.get('/orderlists',auth.isAdminAuth, adminController.orderlists)
router.get('/viewOrderLists/:orderId',auth.isAdminAuth, adminController.viewOrder)
router.patch("/changeStatus",adminController.changeStatus)
router.post("/approve-return/:orderId", adminController.approveReturn)



//coupon manegment

router.get("/coupon",couponController.getCoupon)
router.post('/coupon',couponController.addCoupon)

module.exports = router