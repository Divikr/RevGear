const User = require("../../model/users");
const Address=require("../../model/address")
const bcrypt=require("bcrypt")



const profile = async (req, res) => {
    try {
        const user = req.session.user;
        console.log(user)
        if (!user) {
            return res.redirect('/login');
        }
        
        const userData = await User.findById(user);
        
        if (!userData) {
            return res.redirect('/login');
        }
        
       

        res.render('user/profile', {
            user: userData,
           
        });

    } catch (error) {
        console.error('Error retrieving profile data', error);
        res.redirect('/error');
    }
}


const editProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect('/login');
        }

        const { name, email, phone } = req.body;

       
        if (!name || !email || !phone) {
            return res.status(400).send('All fields are required.');
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name, email, phone },
            { new: true } 
        );

        if (!updatedUser) {
            return res.status(404).send('User not found.');
        }

        res.redirect('/profile'); 
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).redirect('/error'); 
    }
};




const addressBook = async (req, res) => {
    
        try {
            const userId = req.session.user;
            console.log(userId  )
            if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated.' });
    
            const recentAddress = await Address.find({ userId }).sort({ createdAt: -1 });
    
            console.log("Recent Address ======> ", recentAddress);
    
            if (!recentAddress) {
                return res.render("user/addressBook", { recentAddress: [] }); 
            }
    
            res.render("user/addressBook", { recentAddress: recentAddress });
        
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
};

const addAddress = async (req, res) => {
    try {
        res.render("user/addAddress");
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
};

const addressverify = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) return res.status(401).send('User not authenticated.');
        console.log("........................................",userId)

        const { addressType,name, phone, street,apartment,landmark, city,postalCode } = req.body;

        const newAddress = new Address({
        
           addressType:addressType,
           name:name,
           phone:phone,
           street:street,
           apartment:apartment,
           landmark:landmark,
           city:city,
           postalCode:postalCode,
           userId
        
        });
        

        await User.findByIdAndUpdate(userId, {addresses: newAddress._id})

        await newAddress.save();
        res.redirect('/addressbook');
    } catch (error) {
        console.error('Error saving address:', error);
        res.status(500).send('Something went wrong.');
    }
};


 const addAddressFromCheckout = async (req, res) => {
    try {
      const userId = req.session.user; 
      if (!userId) return res.status(401).send('User not authenticated.');
  
      const { addressType, name, phone, street, apartment, landmark, city, postalCode } = req.body;

      const newAddress = new Address({
        addressType,
        name,
        phone,
        street,
        apartment,
        landmark,
        city,
        postalCode,
        userId
      });
  
     console.log("..............new........",newAddress)
      await newAddress.save();
  
      await User.findByIdAndUpdate(userId, { $push: { addresses: newAddress._id } });

      res.status(200).json({ success: true, address: newAddress });
    } catch (error) {
      console.error('Error saving address:', error);
      res.status(500).send('Something went wrong.');
    }
  };

const loadAddressBook = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log(userId  )
        if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated.' });

        const recentAddress = await Address.find({ userId }).sort({ createdAt: -1 });

        console.log("Recent Address ======> ", recentAddress);

        if (!recentAddress) {
            return res.render("user/addressBook", { recentAddress: [] }); 
        }

        res.render("user/addressBook", { recentAddress: recentAddress }); 
    } catch (error) {
        console.error("Error loading address book:", error);
        res.status(500).send("Internal Server Error");
    }
};

const deleteAddress = async (req, res) => {
    const addressId = req.params.id;
   console.log("addressId====>",addressId)

    try {
      
        const result = await Address.findByIdAndDelete(addressId);

        if (result) {
            return res.status(200).json({ success: true, message: 'Address deleted successfully' });
        } else {
            return res.status(404).json({ success: false, error: 'Address not found' });
        }
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const getEditAddress = async (req, res) => {
    try {
      console.log('editing start');
      const adressId = req.query.id
      console.log(adressId);
      const addData = await Address.findById({ _id: adressId })
      console.log(addData);
      if (addData) {
        res.render('user/editAddress', { address: addData })
      } else {
        res.redirect('/addressbook')
      }
  
    } catch (error) {
      console.log('error loading edit cat page');
      console.log(error);
    }
  }


  const editAddress = async (req, res) => {
    try {
        console.log("entering edit address post")
        console.log("req body", req.body);
        
        const {id} = req.params
        const { addressType,name, phone, street,apartment,landmark, city,postalCode } = req.body;

        const updatedAddress = await Address.findByIdAndUpdate(
            {_id:id},
            {  
                addressType:addressType,
                name:name,
                phone:phone,
                street:street,
                apartment:apartment,
                landmark:landmark,
                city:city,
                postalCode:postalCode,
               
             
                },
            { new: true }
        );

        console.log('Address updated:', updatedAddress);


        return res.redirect('/addressbook');
    } catch (error) {
        console.error('Error editing category:', error);
    }
};

const getpassword =  async (req, res) => {
    try {
       
        res.render("user/changePassword");
    } catch (error) {
        console.error("Error rendering home page:", error);
        res.status(500).send("Server error");
    }
};





const postpassword = async (req, res) => {
    try {
        const userId = req.session.user;
        
      
        if (!userId) {
            return res.status(400).json({ message: "User not logged in." });
        }

        console.log("User ID: ", userId);

        const userExist = await User.findOne({ _id: userId });
        
       
        if (!userExist) {
            return res.status(404).json({ message: "User not found." });
        }

        console.log("User Found: ", userExist);

        const { currentpass, newpass, confirmpass } = req.body;

        console.log("Request Body: ", req.body);

        if (newpass !== confirmpass) {
            return res.status(400).json({ message: "New password and confirm password do not match." });
        }

       
        const isMatch = await bcrypt.compare(currentpass, userExist.password);
       
        if (!isMatch) {
            console.log("Current password does not match.");
            return res.status(400).json({ message: "Current password is incorrect." });
        }

       
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newpass, saltRounds);

        userExist.password = hashedPassword;
        await userExist.save();

        console.log("Password updated successfully.");

        return res.status(200).json({ message: "Your password has been changed successfully!" });
     
        
    } catch (error) {
        
        console.error("Error in change password validation:", error);
        return res.status(500).json({ message: "Server error occurred while changing password." });
    }
};




module.exports={
    profile,
    addressBook,
    addAddress,
    getEditAddress,
    addressverify,
    loadAddressBook,
    deleteAddress,
    editAddress,
    getpassword,
    postpassword,
    editProfile,
    addAddressFromCheckout
}