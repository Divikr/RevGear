const Offer=require("../../model/offer")
const Product=require("../../model/product")
const Category=require("../../model/category")
const moment = require('moment')

const offerPage = async (req, res) => {
    try {
        console.log('entered offer page');

    
        const offers = await Offer.find({})
            .populate('productId')  
            .populate('categoryId'); 

      
        const formattedOffers = offers.map(item => {
            const formattedStartDate = moment(item.startDate).format('DD-MM-YYYY');
            const formattedEndDate = moment(item.endDate).format('DD-MM-YYYY');

          
            const productNames = item.productId.map(product => product.productName).join(', ');

            
            const categoryNames = item.categoryId.map(category => category.name).join(', ');
console.log("......",categoryNames)
            return {
                ...item.toObject(),
                formattedStartDate,
                formattedEndDate,
                productNames: productNames || 'N/A', 
                categoryNames: categoryNames || 'N/A', 
            };
        });

        res.render('offer', { offers: formattedOffers });
    } catch (error) {
        console.log('Error in loading offer page:', error);
        res.status(500).send('Internal Server Error');
    }
};




const loadAddOffer = async (req, res) => {
    try {
        console.log('entering load add offer page');

        const products = await Product.find({})

        const categories = await Category.find({})
        console.log("..........gfhdfghtrhdf..........",categories)


        res.render('addoffer', { products: products, categories: categories })
    } catch (error) {
        console.log('error in loading the add offer page');
    }
}

const addOffer = async (req, res) => {
    try {
        const { offerName, discount, startDate, endDate, offerType, productId, categoryId } = req.body;

        // Validate required fields
        if (!offerName || !discount || !startDate || !endDate || !offerType) {
            return res.status(400).json({ success: false, errorMessage: 'All fields are required' });
        }

        // Convert discount to number and validate
        const numericDiscount = Number(discount);
        if (isNaN(numericDiscount) || numericDiscount <= 0) {
            return res.status(400).json({ success: false, errorMessage: 'Invalid discount value' });
        }

        // Parse dates and validate
        const parseDateToLocalMidnight = (dateString) => {
            const date = new Date(dateString);
            date.setHours(0, 0, 0, 0);
            return date;
        };

        const startLocal = parseDateToLocalMidnight(startDate);
        const endLocal = parseDateToLocalMidnight(endDate);
        const todayLocal = parseDateToLocalMidnight(new Date().toISOString());

        if (startLocal < todayLocal) {
            return res.status(400).json({ success: false, errorMessage: 'Start date cannot be in the past' });
        }

        if (startLocal >= endLocal) {
            return res.status(400).json({ success: false, errorMessage: 'End date must be after start date' });
        }

        // Validate offer type
        if (!['Product', 'Category'].includes(offerType)) {
            return res.status(400).json({ success: false, errorMessage: 'Invalid offer type' });
        }

        // Create a new offer instance
        const newOffer = new Offer({
            offerName,
            discount: numericDiscount,
            startDate: startLocal,
            endDate: endLocal,
            offerType,
        });

        // Handle Product Offer
        if (offerType === 'Product') {
            console.log('Processing product offer');

            if (!productId) {
                return res.status(400).json({ success: false, errorMessage: 'Product ID is required for Product offers' });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, errorMessage: 'Product not found' });
            }

            const originalPrice = Number(product.originalPrice || product.salePrice);
            if (isNaN(originalPrice)) {
                return res.status(400).json({ success: false, errorMessage: 'Invalid product price' });
            }

            // Find existing category offer for the product
            const categoryOffer = await Offer.findById(product.categoryOfferId);
            const categoryDiscount = categoryOffer ? Number(categoryOffer.discount) || 0 : 0;

            // Compare discounts and apply the highest one
            const finalDiscount = Math.max(numericDiscount, categoryDiscount);
            const discountedPrice = originalPrice - finalDiscount;

            if (discountedPrice < 0) {
                return res.status(400).json({ success: false, errorMessage: 'Discount exceeds product price' });
            }

            console.log('Applying highest discount:', {
                originalPrice,
                productOffer: numericDiscount,
                categoryOffer: categoryDiscount,
                appliedDiscount: finalDiscount,
                finalPrice: discountedPrice
            });

            // Update product with the highest discount
            await Product.findByIdAndUpdate(
                productId,
                {
                    $set: {
                        salePrice: discountedPrice,
                        productOfferId: numericDiscount >= categoryDiscount ? newOffer._id : product.productOfferId,
                        categoryOfferId: categoryDiscount > numericDiscount ? product.categoryOfferId : newOffer._id,
                        appliedDiscount: finalDiscount,
                    },
                },
                { new: true }
            );

            newOffer.productId = productId;
        }

        // Handle Category Offer
        else if (offerType === 'Category') {
            console.log('Processing category offer');

            if (!categoryId) {
                return res.status(400).json({ success: false, errorMessage: 'Category ID is required for Category offers' });
            }

            const category = await Category.findById(categoryId);
            if (!category) {
                return res.status(404).json({ success: false, errorMessage: 'Category not found' });
            }

            const categoryProducts = await Product.find({ category: category.name });
            if (!categoryProducts.length) {
                return res.status(404).json({ success: false, errorMessage: 'No products found for the category' });
            }

            // Apply discount to each product in the category
            for (const product of categoryProducts) {
                const originalPrice = Number(product.originalPrice || product.salePrice);
                if (isNaN(originalPrice)) continue;

                // Check existing product offer
                const productOffer = await Offer.findById(product.productOfferId);
                const productDiscount = productOffer ? Number(productOffer.discount) || 0 : 0;

                // Compare and apply only the highest discount
                const finalDiscount = Math.max(numericDiscount, productDiscount);
                const discountedPrice = originalPrice - finalDiscount;

                if (discountedPrice < 0) continue;

                console.log('Applying highest discount for category product:', {
                    productId: product._id,
                    originalPrice,
                    productOffer: productDiscount,
                    categoryOffer: numericDiscount,
                    appliedDiscount: finalDiscount,
                    finalPrice: discountedPrice
                });

                // Update product with highest discount
                await Product.findByIdAndUpdate(
                    product._id,
                    {
                        $set: {
                            salePrice: discountedPrice,
                            productOfferId: productDiscount >= numericDiscount ? product.productOfferId : newOffer._id,
                            categoryOfferId: numericDiscount > productDiscount ? newOffer._id : product.categoryOfferId,
                            appliedDiscount: finalDiscount,
                        },
                    },
                    { new: true }
                );
            }

            newOffer.categoryId = categoryId;
        }

        // Save the new offer
        await newOffer.save();
        console.log('Offer saved successfully:', newOffer);

        // Redirect to the offers page
        res.redirect('/admin/offer');
    } catch (error) {
        console.error('Error adding offer:', error);
        res.status(500).json({ success: false, errorMessage: 'Error adding offer: ' + error.message });
    }
};




const deleteOffer = async (req, res) => {
    try {
        console.log('Entered deleting');
        const { offerId } = req.body;

        // Find the offer
        const offer = await Offer.findById(offerId);
        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        console.log(`Deleting offer: ${offer.offerName} (ID: ${offer._id})`);

        if (offer.offerType === 'Product') {
            // Handle product offer deletion
            await handleProductOfferDeletion(offer);
        } else if (offer.offerType === 'Category') {
            // Handle category offer deletion
            await handleCategoryOfferDeletion(offer);
        }

        // Delete the offer
        await Offer.deleteOne({ _id: offerId });
        console.log(`Offer ${offerId} deleted successfully`);

        res.status(200).json({ success: true, message: "Offer deleted successfully" });
    } catch (error) {
        console.log('Error in deleting the offer:', error);
        res.status(500).json({ success: false, message: "Error deleting offer: " + error.message });
    }
};

// Helper function to handle product offer deletion
const handleProductOfferDeletion = async (offer) => {
    const product = await Product.findById(offer.productId);
    if (!product) {
        console.warn(`Product with ID ${offer.productId} not found`);
        return;
    }

    console.log(`Found product: ${product._id}`);
    
    // Calculate the new sale price based on any remaining category offer
    const newSalePrice = await calculateNewSalePrice(product);
    
    // Update the product
    await Product.findByIdAndUpdate(
        product._id,
        {
            $unset: {
                productOfferId: 1,
                productDiscount: 1
            },
            $set: { 
                salePrice: newSalePrice
            }
        },
        { new: true }
    );
    
    console.log(`Updated product ${product._id} salePrice to ${newSalePrice}`);
};

// Helper function to handle category offer deletion
const handleCategoryOfferDeletion = async (offer) => {
    // Find all products in the category
    const category = await Category.findById(offer.categoryId);
    if (!category) {
        console.warn(`Category with ID ${offer.categoryId} not found`);
        return;
    }

    const catProducts = await Product.find({ category: category.name });
    console.log(`Found ${catProducts.length} products in category ${category.name}`);

    for (const product of catProducts) {
        console.log(`Processing product: ${product._id}`);
        
        // Calculate the new sale price based on any remaining product offer
        const newSalePrice = await calculateNewSalePrice(product);

        // Update the product
        await Product.findByIdAndUpdate(
            product._id,
            {
                $unset: {
                    categoryOfferId: 1,
                    categoryDiscount: 1
                },
                $set: { 
                    salePrice: newSalePrice
                }
            },
            { new: true }
        );
        
        console.log(`Updated product ${product._id} salePrice to ${newSalePrice}`);
    }
};

// Helper function to calculate new sale price considering remaining offers
const calculateNewSalePrice = async (product) => {
    let newSalePrice = product.regularPrice;

    // Check for remaining product offer
    if (product.productOfferId) {
        const productOffer = await Offer.findById(product.productOfferId);
        if (productOffer) {
            newSalePrice = product.regularPrice - productOffer.discount;
        }
    }
    
    // Check for remaining category offer
    if (product.categoryOfferId) {
        const categoryOffer = await Offer.findById(product.categoryOfferId);
        if (categoryOffer) {
            const categoryDiscountedPrice = product.regularPrice - categoryOffer.discount;
            // Use the better discount between product and category offers
            newSalePrice = Math.min(newSalePrice, categoryDiscountedPrice);
        }
    }

    // If no offers remain, use regular price
    return Math.max(newSalePrice, 0); // Ensure price doesn't go below 0
};


module.exports={
    offerPage,
    loadAddOffer,
    addOffer,
    deleteOffer
}