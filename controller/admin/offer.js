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

        // Basic validation
        if (!offerName || !discount || !startDate || !endDate || !offerType) {
            return res.status(400).json({ success: false, errorMessage: 'All fields are required' });
        }

        // Validate discount
        const numericDiscount = Number(discount);
        if (isNaN(numericDiscount) || numericDiscount <= 0) {
            return res.status(400).json({ success: false, errorMessage: 'Invalid discount value' });
        }

        const parseDate = (dateString) => {
            const date = new Date(dateString);
            return date;
        };

        const startDateTime = parseDate(startDate);
        const endDateTime = parseDate(endDate);
        const now = new Date();
        const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Date validations
        if (startDateTime < currentDate) {
            return res.status(400).json({ success: false, errorMessage: 'Start date cannot be in the past' });
        }

        if (startDateTime >= endDateTime) {
            return res.status(400).json({ success: false, errorMessage: 'End date must be after start date' });
        }

        // Validate offer type
        if (!['Product', 'Category'].includes(offerType)) {
            return res.status(400).json({ success: false, errorMessage: 'Invalid offer type' });
        }

        // Create new offer
        const newOffer = new Offer({
            offerName,
            discount: numericDiscount,
            startDate: startDateTime,
            endDate: endDateTime,
            offerType,
        });

        // Helper function to get all applicable offers for a product
        const getApplicableOffers = async (product) => {
            const offers = [];
            
            // Check product-specific offers
            if (product.productOfferId) {
                const productOffer = await Offer.findById(product.productOfferId);
                if (productOffer && productOffer.startDate <= now && productOffer.endDate >= now) {
                    offers.push({
                        type: 'Product',
                        discount: productOffer.discount,
                        offerId: productOffer._id
                    });
                }
            }

            // Check category offers
            if (product.categoryOfferId) {
                const categoryOffer = await Offer.findById(product.categoryOfferId);
                if (categoryOffer && categoryOffer.startDate <= now && categoryOffer.endDate >= now) {
                    offers.push({
                        type: 'Category',
                        discount: categoryOffer.discount,
                        offerId: categoryOffer._id
                    });
                }
            }

            return offers;
        };

        // Helper function to apply the best offer
        const applyBestOffer = async (product, newOfferDetails) => {
            const originalPrice = Number(product.originalPrice || product.salePrice);
            if (isNaN(originalPrice)) return null;

            const applicableOffers = await getApplicableOffers(product);
            applicableOffers.push(newOfferDetails);

            // Find the offer with the highest discount
            const bestOffer = applicableOffers.reduce((best, current) => {
                return (current.discount > best.discount) ? current : best;
            }, applicableOffers[0]);

            // Only update if the best offer is different from what's currently applied
            const currentDiscount = product.appliedDiscount || 0;
            if (bestOffer.discount !== currentDiscount) {
                const updateFields = {
                    salePrice: originalPrice - bestOffer.discount,
                    appliedDiscount: bestOffer.discount,
                    productOfferId: null,
                    categoryOfferId: null,
                    [`${bestOffer.type.toLowerCase()}OfferId`]: bestOffer.offerId
                };

                return Product.findByIdAndUpdate(
                    product._id,
                    { $set: updateFields },
                    { new: true }
                );
            }
            return null;
        };

        if (offerType === 'Product') {
            if (!productId) {
                return res.status(400).json({ success: false, errorMessage: 'Product ID is required for Product offers' });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, errorMessage: 'Product not found' });
            }

            // Check for overlapping product offers
            const existingOffer = await Offer.findOne({
                productId: productId,
                startDate: { $lte: endDateTime },
                endDate: { $gte: startDateTime }
            });

            if (existingOffer) {
                return res.status(400).json({ 
                    success: false, 
                    errorMessage: 'An offer already exists for this product during the selected date range' 
                });
            }

            // Only update product if the offer starts today
            const startDateLocal = new Date(startDateTime.setHours(0,0,0,0));
            const currentDateLocal = new Date(currentDate.setHours(0,0,0,0));

            if (startDateLocal.getTime() === currentDateLocal.getTime()) {
                await applyBestOffer(product, {
                    type: 'Product',
                    discount: numericDiscount,
                    offerId: newOffer._id
                });
            }

            newOffer.productId = productId;

        } else if (offerType === 'Category') {
            if (!categoryId) {
                return res.status(400).json({ success: false, errorMessage: 'Category ID is required for Category offers' });
            }

            const category = await Category.findById(categoryId);
            if (!category) {
                return res.status(404).json({ success: false, errorMessage: 'Category not found' });
            }

            // Check for overlapping category offers
            const existingOffer = await Offer.findOne({
                categoryId: categoryId,
                startDate: { $lte: endDateTime },
                endDate: { $gte: startDateTime }
            });

            if (existingOffer) {
                return res.status(400).json({ 
                    success: false, 
                    errorMessage: 'An offer already exists for this category during the selected date range' 
                });
            }

            const categoryProducts = await Product.find({ category: category.name });
            if (!categoryProducts.length) {
                return res.status(404).json({ success: false, errorMessage: 'No products found for the category' });
            }

            // Only update products if the offer starts today
            const startDateLocal = new Date(startDateTime.setHours(0,0,0,0));
            const currentDateLocal = new Date(currentDate.setHours(0,0,0,0));

            if (startDateLocal.getTime() === currentDateLocal.getTime()) {
                for (const product of categoryProducts) {
                    await applyBestOffer(product, {
                        type: 'Category',
                        discount: numericDiscount,
                        offerId: newOffer._id
                    });
                }
            }

            newOffer.categoryId = categoryId;
        }

        // Save the offer
        await newOffer.save();
        console.log('Offer saved successfully:', newOffer);

        res.redirect('/admin/offer');
    } catch (error) {
        console.error('Error adding offer:', error);
        res.status(500).json({ success: false, errorMessage: 'Error adding offer: ' + error.message });
    }
};




const deleteOffer = async (req, res) => {
    try {
        console.log('Entered deleting offer');
        const { offerId } = req.body;

    
        const offer = await Offer.findById(offerId);
        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        console.log(`Deleting offer: ${offer.offerName} (ID: ${offer._id})`);

       
        if (offer.offerType === 'Product') {
           
            await handleProductOfferDeletion(offer);
        } else if (offer.offerType === 'Category') {
           
            await handleCategoryOfferDeletion(offer);
        }

       
        await Offer.deleteOne({ _id: offerId });
        console.log(`Offer ${offerId} deleted successfully`);

        res.status(200).json({ success: true, message: "Offer deleted successfully" });
    } catch (error) {
        console.log('Error in deleting the offer:', error);
        res.status(500).json({ success: false, message: "Error deleting offer: " + error.message });
    }
};

const handleProductOfferDeletion = async (offer) => {
    const product = await Product.findById(offer.productId);
    if (!product) {
        console.warn(`Product with ID ${offer.productId} not found`);
        return;
    }

    console.log(`Found product: ${product._id}`);

   
    const newSalePrice = await calculateNewSalePrice(product);

    
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


const handleCategoryOfferDeletion = async (offer) => {
   
    const category = await Category.findById(offer.categoryId);
    if (!category) {
        console.warn(`Category with ID ${offer.categoryId} not found`);
        return;
    }

    const catProducts = await Product.find({ category: category.name });
    console.log(`Found ${catProducts.length} products in category ${category.name}`);

    for (const product of catProducts) {
        console.log(`Processing product: ${product._id}`);

        const newSalePrice = await calculateNewSalePrice(product);

       
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


const calculateNewSalePrice = async (product) => {
    let newSalePrice = product.regularPrice;

    if (product.productOfferId) {
        const productOffer = await Offer.findById(product.productOfferId);
        if (productOffer) {
            newSalePrice = product.regularPrice - productOffer.discount;
        }
    }

  
    if (product.categoryOfferId) {
        const categoryOffer = await Offer.findById(product.categoryOfferId);
        if (categoryOffer) {
            const categoryDiscountedPrice = product.regularPrice - categoryOffer.discount;
          
            newSalePrice = Math.min(newSalePrice, categoryDiscountedPrice);
        }
    }

   
    return Math.max(newSalePrice, 0);
};

module.exports={
    offerPage,
    loadAddOffer,
    addOffer,
    deleteOffer
}