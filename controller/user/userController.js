const User = require("../../model/users");
const bcrypt = require('bcrypt');
const sendotp = require("../../utils/otpNodemailer");
const Products = require('../../model/product');
const Category = require("../../model/category");

const homePage = async (req, res) => {
    try {
        res.render("user/homeWithoutUser");
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
};

const loadsignup = async (req, res) => {
    try {
        res.render("user/signUp");
    } catch (error) {
        console.error("Error rendering signup page:", error);
        res.status(500).send("Server error");
    }
};

const signup = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send("User already exists");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const otp = generateOTP();
        const otpTimeStamp = new Date().getTime();

        req.session.userData = {
            name,
            email,
            phone,
            password: hashedPassword, 
            otpTimeStamp
        };
        req.session.newUserOtp = otp;

        sendotp(email, name, otp);
console.log(otp)
        res.redirect("/otp");
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).send("Internal Server Error");
    }
};

const otp = async (req, res) => {
    try {
        res.render("user/otpVerification");
    } catch (error) {
        console.error("Error rendering OTP page:", error);
        res.status(500).send("Server error");
    }
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000); 
};

const otpPost = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionOtp = req.session.newUserOtp;

        if (otp == sessionOtp) {
            const { name, email, phone, password } = req.session.userData;

            const newUser = new User({
                name,
                email,
                phone,
                password,
                googleId: null,
            });

            await newUser.save();

            req.session.userData = null;
            req.session.newUserOtp = null;

            return res.json({ success: true, message: "OTP verified successfully!" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }
    } catch (error) {
        console.error("Error in OTP verification:", error.message);
        res.status(500).json({ success: false, message: "An error occurred while verifying the OTP." });
    }
};

const resendOtp = async (req, res) => {
    try {

        if (!req.session.userData) {
            return res.status(400).send("Session expired. Please restart the signup process.");
        }

        const newOtp = generateOTP();
        req.session.newUserOtp = newOtp;

        const { email, name } = req.session.userData;

        sendotp(email, name, newOtp);

        res.redirect("/otp");
    } catch (error) {
        console.error("Error in resending OTP:", error.message);
        res.status(500).send("An error occurred while resending the OTP.");
    }
};

const loadlogin = async (req, res) => {
    try {
        if (!req.session.user) {
            res.render("user/login");
        } else {
            res.redirect("/home");
        }
    } catch (error) {
        console.error("Error rendering login page:", error);
        res.status(500).send("Server error");
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render("user/login", { error: "All fields are required." });
        }

        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).render("user/login", { error: "Invalid email or password" });
        }

        req.session.user = user; 
        res.redirect("/home");
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).render("user/login", { error: "Internal Server Error" });
    }
};

const home = async (req, res) => {
    try {
        const products = await Products.find({ isBlocked: false }).limit(4);
        const categories = await Category.find({isListed:true});

        console.log(products)
        res.render("user/home", { products, categories });
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
};


const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                res.redirect("/home")
            } 
        })

        res.redirect('/')
    } catch (error) {
        console.log(error.message)
    }
}

const product = async (req, res) => {
    try {
        const products = await Products.find({ isBlocked: false });
        const categories = await Category.find({});
        res.render("user/allProducts", { products, categories });
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
};

const category = async (req, res) => {
    try {
        const categories = await Category.find({});
        res.render("user/allCategory", { categories });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server error')
    }
}



const searchProducts = async (req, res) => {
    try {
        const { query } = req.query; 
        if (!query) {
            return res.status(400).send("Query parameter is required.");
        }

        const products = await Products.find({
            isBlocked: false,
            $or: [
                { productName: { $regex: query, $options: 'i' } }, 
                { description: { $regex: query, $options: 'i' } }  
            ]
        });

        const categories = await Category.find({}); 

        if (products.length === 0) {
            return res.render('user/allProducts', {
                products: [],
                categories, 
                message: 'No products found!',
            });
        }

        res.render('user/allProducts', {
            products,
            categories, 
        });
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = {
    homePage,
    loadsignup,
    signup,
    loadlogin,
    login,
    otp,
    home,
    otpPost,
    resendOtp,
    product,
    logout,
    category,
    searchProducts
};
