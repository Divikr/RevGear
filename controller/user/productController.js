
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



const getProductByCategory = async (req,res) => {
  try {
    const {name} = req.params;
    const categories = await Category.find({})
    const products = await Product.find({category: name});
    console.log(products)
    res.render('user/allProducts', {products, categories})
  } catch (error) {
    
  }
}

const addToWishlist = async (req, res) => {
    try {
      const { productId } = req.body;
      const userId = req.session.user;
      console.log(userId)
  
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
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
      return res.status(401).json({ message: "User not authenticated", redirect: "/login" });
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
      return res.status(404).json({ message: "Product not found" });
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
          message: `Cannot add more than available stock. Available stock: ${product.quantity}`,
        });
      }

      cartItem.quantity = newQuantity;
      cartItem.totalPrice = cartItem.quantity * product.salePrice;
    } else {
      if (validQuantity > product.quantity) {
        return res.status(400).json({
          message: `Cannot add more than available stock. Available stock: ${product.quantity}`,
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




const updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated", redirect: "/login" });
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
        message: `Cannot update to more than available stock. Available stock: ${product.quantity}`,
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





const removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!req.session.user ) {
      return res.status(401).json({ message: 'User not authenticated', redirect: "/login" });
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


const placeOrder = async (req,res) => {
 try {
    const { savedaddress, paymentMethod, cart } = req.body;
    const userId = req.session.user;
    console.log("...................",{savedaddress, paymentMethod, cart})

    if (!savedaddress || !paymentMethod || !Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid order details.' });
    }

const address = await Address.findById({_id:savedaddress})

    let totalAmount = 0;
    const items = cart.map(item => {
        if (!item.productId || !item.productId.salePrice || !item.quantity) {
            throw new Error('Invalid item in cart.');
        }

        const itemTotal = item.productId.salePrice * item.quantity;
        totalAmount += itemTotal;

        return {
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salePrice
        };
    });



    const newOrder = new Order({
        userId,
        deliveryAddress: address,
        items,
        totalAmount,
        paymentMethod
    });

console.log("..........address..........",newOrder)

    const savedOrder = await newOrder.save();

    console.log("................",savedOrder)

    for (const item of items) {
        const updatedProduct = await Product.findOneAndUpdate(
            { _id: item.productId },
            { $inc: { quantity: -item.quantity } }, 
            { new: true } 
        );

        if (updatedProduct && updatedProduct.quantity === 0) {
            await Product.findByIdAndUpdate(item.productId, {
                status: "Out of Stock",
            });
        }
    }

    res.status(201).json({ success: true, message: 'Order placed successfully!', orderId: savedOrder._id });
} catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ success: false, message: 'An error occurred while placing the order.' });
}
}

const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session.user?.id;

    console.log(`Attempting to remove product ${productId} for user ${userId}`);

   
    if (!userId) {
      console.log('User not authenticated');
      return res.status(401).json({ message: "User not authenticated" });
    }


    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      console.log(`Wishlist not found for user ${userId}`);
      return res.status(404).json({ message: "Wishlist not found" });
    }

   
    const productIndex = wishlist.products.findIndex(item => 
      item.productId.toString() === productId
    );

    if (productIndex === -1) {
      console.log(`Product ${productId} not found in wishlist for user ${userId}`);
      return res.status(404).json({ message: "Product not found in wishlist" });
    }

   
    wishlist.products.splice(productIndex, 1);

    await wishlist.save();
    console.log(`Product ${productId} removed from wishlist for user ${userId}`);
    res.status(200).json({ message: "Product removed from wishlist successfully" });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.status(500).json({ message: "Error removing from wishlist", error: error.message });
  }
};




const getCheckout = async (req, res) => {
  try {
    const user = req.session.user; 
    const userId = user._id; 
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send('Invalid User ID');
    }


    const cart = await Cart.findOne({ userId }).populate('items.productId'); 

    const savedAddresses = await Address.find({ userId });

    const total = cart.items.reduce((sum, item) => sum + item.productId.salePrice * item.quantity, 0);

    res.render('user/checkout', { cart: cart.items, savedAddresses, total });
  } catch (error) {
    console.error('Error in checkout:', error.message);
    res.status(500).send('Server error');
  }
};


const orderconfirm = async (req, res) => {
  try {
      const {id} = req.params;
      const userId = req.session.user;
    
      await Cart.findOneAndUpdate(
        { userId },
        { $set: { items: [] } }
      );
;
      const order = await Order.findById({_id:id});
      res.render("user/orderConfirmation", {order});
  } catch (error) {
      console.error("Error rendering home page:", error);
      res.status(500).send("Server error");
  }
};



const orderdetails = async (req, res) => {
  try {
      const {id} = req.params;
      const order = await Order.findById({_id: id}).populate("items.productId");
      res.render("user/orderDetails",{order});
  } catch (error) {
      console.error("Error rendering home page:", error);
      res.status(500).send("Server error");
  }
};


const orderlist = async (req, res) => {
  try {
     const id=req.session.user._id;
     
     const orders=await Order.find({userId:id})
     console.log(orders)
    
      res.render("user/orderList",{orders});
  } catch (error) {
      console.error("Error rendering home page:", error);
      res.status(500).send("Server error");
  }
};

const getAllProducts = async (req, res) => {
  try {
      const { sort } = req.query; 

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

      
      const products = await Product.find({ isBlocked: false }).sort(sortCriteria);

      res.render('user/allProducts', { products });
  } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).send('Internal Server Error');
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
    getCheckout,
    orderconfirm,
    orderdetails,
    placeOrder,
    orderlist,
    getProductByCategory,
    getAllProducts,
    removeFromCart
}