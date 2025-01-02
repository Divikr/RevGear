const User = require("../../model/users");

//get page

const getCustomer = (req,res) => {
    try {
        res.render('customer')
    } catch (error) {
        console.log(error.message)
    }
}

//customer info

const customerInfo = async (req, res) => {
  try {
      if (!req.session.admin) {
          return res.redirect('/admin/login');
      }

      let search = req.query.search || '';
      let page = parseInt(req.query.page) || 1; 
      const limit = 5;

      const userData = await User.find({
          isAdmin: false,
          $or: [
              { name: { $regex: ".*" + search + ".*", $options: "i" } },
              { email: { $regex: ".*" + search + ".*", $options: "i" } }
          ]
      })
          .limit(limit)
          .skip((page - 1) * limit);

      const count = await User.find({
          isAdmin: false,
          $or: [
              { name: { $regex: ".*" + search + ".*", $options: "i" } },
              { email: { $regex: ".*" + search + ".*", $options: "i" } }
          ]
      }).countDocuments();

      const adminName = req.session.admin.name;

      res.render("customer", {
          data: userData,
          totalPages: Math.ceil(count / limit),
          currentPages: page,
          search,
          adminName,
          error: null
      });
  } catch (error) {
      console.error("Error fetching customer info:", error);
      res.render("customer", {
          data: [],
          totalPages: 0,
          currentPages: 1,
          search: '',
          adminName: req.session.admin ? req.session.admin.name : '',
          error: "An error occurred while fetching customer information."
      });
  }
};


//toggle button

const toggleCustomerBlock = async (req, res) => {
  try {
      const id = req.query.id;
      const page = req.query.page || 1; 
      const search = req.query.search || ''; 

      const customer = await User.findById(id);

      if (!customer) {
          return res.status(404).json({ error: "Customer not found" });
      }

      const newStatus = !customer.isBlocked;
      await User.updateOne({ _id: id }, { $set: { isBlocked: newStatus } });

      res.redirect(`/admin/customer?page=${page}&search=${encodeURIComponent(search)}`);
  } catch (error) {
      console.error("Error toggling customer block status:", error);
      res.status(500).json({ error: "Failed to toggle customer block status" });
  }
};





module.exports = { 
  customerInfo,
  toggleCustomerBlock,
  getCustomer
}