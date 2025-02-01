const User = require("../../model/users");
const bcrypt = require('bcrypt');
const sendotp = require("../../utils/otpNodemailer");
const Products = require('../../model/product');
const Category = require("../../model/category");
const { name } = require("ejs");

const homePage = async (req, res) => {
    try {
        res.render("user/home");
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
};



const about = async (req, res) => {
    try {
        res.render("user/about");
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
};




const contact = async (req, res) => {
    try {
        res.render("user/contactus");
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

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).render("user/login", { error: "Invalid email format." });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).render("user/login", { error: "Invalid email or password" });
        }

        if (user.isBlocked) {
            return res.status(403).render("user/login", { error: "You have been blocked. Please contact support." });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).render("user/login", { error: "Invalid email or password" });
        }

        req.session.user = user;
        res.redirect("/home");
    } catch (error) {
        console.error(`Login error for email ${req.body.email}:`, error.message);
        res.status(500).render("user/login", { error: "Internal Server Error" });
    }
};


const getForget= async  (req,res)=>{
    try {
        res.render("user/forgetPassword")

    } catch (error) {
        console.log(error.message)
    }
}


const postForget = async (req, res) => {
    try {
      const { email } = req.body;
  
      const existingUser = await User.findOne({ email });
      if (!existingUser) {
        return res.render("user/forgetPassword", {
          error: "No account found with this email address.",
          success: null,
        });
      }
  
      const { name } = existingUser;
  
      const otpData = generateotp();
      console.log(`Generated OTP for email ${email}: ${otpData.code}`);
  

      req.session.forgotPasswordOtp = {
        code: otpData.code,
        timestamp: otpData.timestamp,
        email,
      };

      await sendotp(email, name, otpData.code);

      res.redirect("/otpforget");
    } catch (error) {
      console.error("Error during forgot password process:", error);
      res.render("user/forgetPassword", {
        error: "An unexpected error occurred. Please try again.",
        success: null,
      });
    }
  };
  

const otpforget = async (req, res) => {
    try {
        res.render("user/otpforget");
    } catch (error) {
        console.error("Error rendering OTP page:", error);
        res.status(500).send("Server error");
    }
};

const generateotp = () => {
    const otpCode = Math.floor(100000 + Math.random() * 900000); 
    const timestamp = new Date().getTime();
    return { code: otpCode, timestamp };
  };


  const resendotp = async (req, res) => {
    try {
    
        console.log("Session Data: ", req.session);

       

        const newOtp = generateOTP();

        req.session.otp = newOtp;

        const { email, name } = existingUser;
        console.log("User Data: ", { email, name });
        sendotp(email, name, newOtp);
        res.redirect("/otpforget");
    } catch (error) {
        console.error("Error in resending OTP:", error.message);
        res.status(500).send("An error occurred while resending the OTP.");
    }
};



const verifyPasswordOtp = (req, res) => {
    try {
        console.log("Request Body:", req.body);
        console.log("Session Data:", req.session.forgotPasswordOtp);

        const { otp } = req.body;
        const otpData = req.session.forgotPasswordOtp;

        if (!otpData) {
            return res.status(400).json({
                success: false,
                message: "OTP session expired. Please request a new OTP.",
                expired: true
            });
        }
        if (String(otp) !== String(otpData.code)) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP. Please try again."
            });
        }

        res.status(200).json({
            success: true,
            message: "OTP verified successfully."
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred during OTP verification."
        });
    }
};



const setPassword = async (req, res) => {
    try {
        res.render("user/setPassword");
    } catch (error) {
        console.error("Error rendering OTP page:", error);
        res.status(500).send("Server error");
    }
};





const setNewPassword = async (req, res) => {
    try {
        const { newpass, confirmpass } = req.body;
        const { email } = req.session.forgotPasswordOtp;


        if (newpass !== confirmpass) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match.",
            });
        }
        const user = await User.findOne({email});
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        const hashedPassword = await bcrypt.hash(newpass, 10);
        user.password = hashedPassword;
        await user.save();

        req.session.forgotPasswordOtp = null;

        return res.status(200).json({
            success: true,
            message: "Your password has been changed successfully!",
        });
    } catch (error) {
        console.error("Error in setNewPassword:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while setting the new password.",
        });
    }
};





const home = async (req, res) => {
    try {
     
        const product = await Products.find({ isBlocked: false })
            .sort({ salesCount: -1 }) 
            .limit(4);

        const products = await Products.find({ isBlocked: false })
            .sort({ salePrice: 1 })
            .limit(4);

        const categories = await Category.find({ isListed: true });

        res.render("user/home", { product, products, categories });
    } catch (error) {
        console.error("Error fetching products for the home page:", error);
        res.status(500).send("An error occurred while loading the page.");
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

const getAllProducts = async (req, res) => {
    try {
        const { page = 1, limit = 5, sort } = req.query;
        console.log("guiifdbfgujh",req.body)

  
        let sortCriteria = {};
        switch (sort) {
            case 'a-z':
                sortCriteria = { productName: 1 };
                break;
            case 'z-a':
                sortCriteria = { productName: -1 };
                break;
            case 'low-to-high':
                sortCriteria = { salePrice: 1 };
                break;
            case 'high-to-low':
                sortCriteria = { salePrice: -1 };
                break;
            default:
                sortCriteria = {};
        }


        
        const products = await Products.find({ isBlocked: false })
            .sort(sortCriteria)
            .skip((page - 1) * 8)
            .limit(8);

        const totalProducts = await Products.countDocuments({ isBlocked: false });
        const totalPages = Math.ceil(totalProducts / 8);

        res.render('user/allProducts', {
            products,
            currentPage: parseInt(page),
            totalPages,
            limit: 8,
            sort,  
            query: req.query 
        });
    } catch (error) {
        console.error('Error fetching products with sorting and pagination:', error);
        res.status(500).send('Internal Server Error');
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
        })
        .select('productName productImage') 
        .lean(); 

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
            sort
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
    getAllProducts,
    logout,
    category,
    searchProducts,
    getForget,
    postForget,
    otpforget,
    generateotp,
    verifyPasswordOtp,
    setPassword,
    resendotp,
    setNewPassword,
    about,
    contact
};
