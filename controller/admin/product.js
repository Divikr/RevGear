const User = require("../../model/users");
const multer = require('multer');
const Product = require("../../model/product")
const Category = require('../../model/category');
const upload = multer({ dest: 'public/uploads/products/' });


//get product

const getProduct = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 5);
    const skip = (page - 1) * limit;

    const search = req.query.search || ''; 

    const searchQuery = search
      ? { name: { $regex: search, $options: 'i' } } 
      : {};

    const totalProducts = await Product.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(searchQuery)
      .skip(skip)
      .limit(limit);

    res.render('products', {
      products,
      currentPage: page,
      totalPages,
      totalProducts,
      limit,
      search, 
    });
  } catch (error) {
    console.error("Error in getProduct:", error.message);
    res.status(500).send("Internal Server Error");
  }
};


//get addproduct

const addproduct = async (req, res) => {
  try {
    const categories = await Category.find({});
    res.render('addProducts', { categories })
  } catch (error) {
    console.log(error.message)
  }
}


//post addproduct

const addProduct = async (req, res) => {


  try {
   
    console.log("body---------------------------------", req.body, "body--------------------------------------------------")

    const productImages = req.files ? req.files.map((file) => file.path.replace("public", "")) : [];


 


    const newProduct = new Product({
      productName: req.body.productName,
      category: req.body.category,
      regularPrice: parseFloat(req.body.regularPrice) || 0,
      salePrice: parseFloat(req.body.salePrice) || 0,
      productOffer: parseFloat(req.body.productOffer) || 0,
      quantity: parseInt(req.body.quantity) || 0,
      productImage: productImages,
      description: req.body.description,
      status: req.body.status || "Available",
    });
    
    const savedProduct = await newProduct.save();

    res.status(201).json({
      message: "Product added successfully!",
      product: savedProduct,
    });

   
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Failed to add product" });
  }
};


//get edit product

const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    const categories = await Category.find();

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.render('editProduct', { product, categories });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};



const updateProduct = async (req, res) => {
  console.log("iam hereeeeeee");
  try {

    const productId = req.params.id;
    const {
      productName,
      category,
      regularPrice,
      salePrice,
      productOffer,
      quantity,
      description,
      deletedImages
    } = req.body;


    console.log('Product ID:', productId);
    console.log('Uploaded Files:', req.files);
    console.log('Body:', req.body);

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let updatedProductImages = existingProduct.productImage || [];
    if (deletedImages) {
      const deletedImagesList = JSON.parse(deletedImages);
      updatedProductImages = updatedProductImages.filter(
        image => !deletedImagesList.includes(image)
      );
    }

    
    if (req.files && req.files.length > 0) {
      const newImages = req.files ? req.files.map((file) => file.path.replace("public", "")) : [];
      console.log('New Image Filenames:', newImages);
      updatedProductImages = [...updatedProductImages, ...newImages];
    }

    const updateData = {
      productName,
      category,
      regularPrice,
      salePrice,
      productOffer,
      quantity,
      description,
      productImage: updatedProductImages
    };

   if(quantity>0){
    await Product.findByIdAndUpdate( productId,
      {
          $set: {
              status:"Available"
          },
      },
      { new: true })
   }
   
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true }
    );

    res.redirect('/admin/product');
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).json({ error: 'Update failed', details: error.message });
  }
};


//block product

const blockProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    product.isBlocked = !product.isBlocked;

    await product.save();

    res.redirect('/admin/product');
  } catch (error) {
    console.error("Error blocking/unblocking product:", error);
    res.status(500).json({ error: "Failed to block/unblock product" });
  }
};








module.exports = {
  getProduct,
  addproduct,
  addProduct,
  editProduct,
  updateProduct,
  blockProduct,
 }