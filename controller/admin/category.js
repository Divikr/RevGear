const Category = require("../../model/category");
const multer=require('multer')
const path = require('path')


const getCategory = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.redirect('/admin/login');
    }

    let search = '';
    if (req.query.search) {
      search = req.query.search;
    }

    let page = 1;
    if (req.query.page) {
      page = parseInt(req.query.page);
    }

    const limit = 4;
    const categoryData = await Category.find({
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
   
      ],
    })
      .sort({createdAt:-1})
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await Category.find({
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
       
      ],
    }).countDocuments();

    const adminName = req.session.admin.name;

    res.render("category", {
      cat: categoryData,
      totalPages: Math.ceil(count / limit),
      currentPages: page,
      search,
      adminName,
      error: null,
    });
  } catch (error) {
    console.error("Error fetching category info:", error.message);
    res.render("category", {
      cat: [],
      totalPages: 0,
      currentPages: 1,
      search: '',
      adminName: req.session.admin ? req.session.admin.name : '',
      error: "An error occurred while fetching category information.",
    });
  }
};

const addCategory = (req, res) => {
  try {
    res.render('addCategory');
  } catch (error) {
    console.log(error.message);
  }
};



const addCategorys = async (req, res) => {
  const { name, description, categoryOffer } = req.body;

  try {
   
    const Images = req.files 
      ? req.files.map((file) => `/uploads/${file.filename}`)
      : [];

    const newCategory = new Category({
      name,
      description,
      categoryOffer,
      Image: Images 
    });

    await newCategory.save();
    res.json({ success: true, message: 'Category saved successfully!' });
  } catch (error) {
    console.error(error);
    
   
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'A category with this name already exists' 
      });
    }
    
    res.status(500).json({ success: false, message: 'Error saving category' });
  }
};



const toggleCategoryStatus = async (req, res) => {
  const { id } = req.query; 

  try {

    console.log(id)
      const category = await Category.findById(id);

      if (!category) {
          return res.status(404).json({ success: false, message: 'Category not found' });
      }
      category.isListed = !category.isListed;
      await category.save();
      res.redirect('/admin/category');
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error toggling category status' });
  }
};



const editCategory = async (req, res) => {
  try {

    const { id } = req.params;  

    const category = await Category.findOne({ _id:id });

    if (!category) {
      return res.status(404).send('Category not found');
    }

    res.render('editCategory', {
      cat: category
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Server Error');
  }
};

const editsCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, categoryOffer } = req.body;

    const category = await Category.findById(id);
    if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
    }

    category.name = name || category.name;
    category.description = description || category.description;
    category.categoryOffer = categoryOffer || category.categoryOffer;

    console.log('file image updated =====> ', req.file)

    if (req.file) {
      
        if (category.Image) {
            const oldImagePath = path.join(__dirname, '..', category.Image[0]);
            try {
                await fs.unlink(oldImagePath);
            } catch (error) {
                console.warn(`Failed to delete old image: ${oldImagePath}`, error.message);
            }
        }
      
        category.Image = `/uploads/${req.file.filename}`;
    }

    await category.save();
    res.status(200).json({ success: true, message: 'Category updated successfully' });
  } catch (error) {
    console.error("Error updating category:", error.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getCategoriesForProduct = async (req, res) => {
  try {
      const categories = await Category.find({ isListed: true }, 'name _id');
      res.json(categories);
  } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
  }
};



module.exports = {
  getCategory,
  addCategory,
  addCategorys,
  toggleCategoryStatus,
  editCategory,
  editsCategory,
  getCategoriesForProduct
};
