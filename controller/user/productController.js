
const User = require("../../model/users");
const Category = require('../../model/category');
const Product = require('../../model/product')
const Wishlist = require("../../model/wishlist"); 
const Cart = require("../../model/cart"); 
const Address = require('../../model/address');
const Order = require('../../model/Order');
const mongoose = require("mongoose"); 
const path = require("path");




const singleproduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id).limit(4);
        const relatedProducts = await Product.find({ category: product.category, isBlocked: false });
        res.render("user/singleProduct", { product, relatedProducts });
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
};




//wishlist manegment..............

const getwishlist = async (req, res, next) => {
  try {
      const userId = req.session.user;


      const currentUser = await User.findById(userId);
      const categories = await Category.find({});
      const wishlist = await Wishlist.findOne({ userId }).populate('products');
     

      const wishlistProducts = wishlist ? wishlist.products : [];

      if (wishlistProducts.length > 0) {
          const productIds = wishlistProducts.map(item => item.productId);
          const products = await Product.find({ _id: { $in: productIds } });

          return res.render('user/wishlist', {
              wishlistProducts: products,
              user: currentUser,
              categories
             
          });
      } else {
          return res.render('user/wishlist', {
              wishlistProducts: [],
              user: currentUser,
              categories
              
          });
      }
  } catch (error) {
      console.error(error.message);
      const errorMessage = { message: "An error occurred. Please try again later." };
      next(error);
  }
};



//get allproduct

const getProductByCategory = async (req, res) => {
  try {
    const { name } = req.params;
    const { sort } = req.query;
    console.log("hjjjh",req.params)
    
    const categories = await Category.find({});
    
    
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

    const products = await Product.find({ 
      category: name,
      isBlocked: false 
    }).sort(sortCriteria);

    res.render('user/allProducts', {
      products,
      categories,
      sort, 
      currentPage: 1,
      totalPages: 1,
      limit: products.length
    });

  } catch (error) {
    console.error('Error in getProductByCategory:', error);
    res.status(500).send('Internal Server Error');
  }
}

const addToWishlist = async (req, res) => {
    try {
      const { productId } = req.body;
      const userId = req.session.user;
      console.log(userId)
  
      
      if (!userId) {
        return res.status(401).json({ message: "Please Login" });
      }
  
     
      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }
  
     
      let wishlist = await Wishlist.findOne({ userId });
      if (!wishlist) {
        wishlist = new Wishlist({ userId, products: [] });
      }
  
      
      const productExists = wishlist.products.some(item => 
        item.productId.toString() === productId
      );
  
      if (!productExists) {
       
        wishlist.products.push({ productId });
        await wishlist.save();
        res.status(200).json({ message: "Product added to wishlist successfully" });
      } else {
        res.status(200).json({ message: "Product is already in the wishlist" });
      }
    } catch (error) {
      console.error("Error adding to wishlist:", error);
      res.status(500).json({ message: "Error adding to wishlist", error: error.message });
    }
  };




//cart manegment


const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ message: "Please Login", redirect: "/login" });
    }

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const validQuantity = parseInt(quantity, 10);
    if (isNaN(validQuantity) || validQuantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found " });
    }

    if (product.status !== "Available") {
      return res.status(400).json({ message: "Product is not available" });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    let cartItem = cart.items.find(item => item.productId.toString() === productId);

    if (cartItem) {
      const newQuantity = cartItem.quantity + validQuantity;
      if (newQuantity > product.quantity) {
        return res.status(400).json({
          message: `Only ${product.quantity} items are available in stock.`,
        });
      }

      cartItem.quantity = newQuantity;
      cartItem.totalPrice = cartItem.quantity * product.salePrice;
    } else {
      if (validQuantity > product.quantity) {
        return res.status(400).json({
          message: `Only ${product.quantity} items are available in stock.`,
        });
      }

      const newItem = {
        productId,
        quantity: validQuantity,
        price: product.salePrice,
        totalPrice: validQuantity * product.salePrice,
      };
      cart.items.push(newItem);
    }

    await cart.save();
    res.status(200).json({ message: "Product added to cart successfully" });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ message: "Error adding to cart", error: error.message });
  }
};

//update cart


const updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ message: "Please Login", redirect: "/login" });
    }

    const validQuantity = parseInt(quantity, 10);
    if (isNaN(validQuantity) || validQuantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (validQuantity > product.quantity) {
      return res.status(400).json({
        message: `Only ${product.quantity} items are available in stock.`,
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const cartItem = cart.items.find(item => item.productId.toString() === productId);
    if (!cartItem) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    cartItem.quantity = validQuantity;
    cartItem.totalPrice = validQuantity * product.salePrice;

    await cart.save();

    const total = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    res.status(200).json({
      message: "Cart updated successfully",
      item: cartItem,
      total,
    });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ message: "Error updating cart", error: error.message });
  }
};

//get cart

const getcart = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    const userData = await User.findById(userId);

    if (!cart || cart.items.length === 0) {
      return res.render('user/cart', { 
        cart: [], 
        total: 0, 
        user: userData,
      });
    }

    const validCartItems = cart.items.filter(item => 
      item.productId != null && 
      !item.productId.isBlocked && 
      item.productId.status === "Available"
    );

   
    if (validCartItems.length !== cart.items.length) {
      await Cart.findOneAndUpdate(
        { userId },
        { items: validCartItems },
        { new: true }
      );
    }

    
    const total = validCartItems.reduce(
      (sum, item) => sum + (item.productId.salePrice * item.quantity),
      0
    );

 
    res.render('user/cart',     { 
      cart: validCartItems, 
      total, 
      user: userData,
      userEmail: req.session.user.email ,
      messages: null

    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    
    
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      
      res.status(500).json({ 
        message: "Unable to load your shopping cart at this time. Please try again later.",
        error: error.message 
      });
    } else {
      res.redirect('/');
    }
  }
};


//remove from cart


const removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!req.session.user ) {
      return res.status(401).json({ message: 'Please Login', redirect: "/login" });
    }


    let cart = await Cart.findOne({ userId: req.session.user });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const itemIndex  = cart.items.filter(item => item.productId.toString() !== itemId);

    cart.items.splice(itemIndex,1);
    await cart.save();

    res.status(200).json({ message: 'Item removed from cart successfully' });
  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({ message: 'Error removing item from cart', error: error.message });
  }
};


//place order






const  removeFromWishlist = async (req, res) => {
  try {
      const { productId } = req.params; 
      const user = req.session.user; 

      console.log("User:", user);
      console.log("Product ID to remove:", productId);

      
      const updatedWishlist = await Wishlist.findOneAndUpdate(
          { userId: user },
          { $pull: { products: { productId } } }, 
          { new: true }
      );

      if (updatedWishlist) {
    
          res.status(200).json({ removed: true });
      } else {
        
          res.status(404).json({ success: false, message: 'Product not found in wishlist.' });
      }
  } catch (error) {
      console.error('Error deleting product from wishlist:', error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
};
















module.exports = {
    singleproduct,
    getcart,
    getwishlist,
    addToWishlist,
    addToCart,
    updateCart,
    removeFromWishlist,
    getProductByCategory,
    removeFromCart,
    

   
}