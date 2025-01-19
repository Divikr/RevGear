const Offer=require("../../model/offer")
const Product=require("../../model/product")
const Category=require("../../model/category")
const moment = require('moment')

const offerPage = async (req, res) => {
    try {
        console.log('entered offer page');

        // Fetch offers with populated productId and categoryId
        const offers = await Offer.find({})
            .populate('productId')  // Populate productId to fetch product details
            .populate('categoryId'); // Populate categoryId to fetch category details

        // Format dates and add productNames and categoryNames to the offer object
        const formattedOffers = offers.map(item => {
            const formattedStartDate = moment(item.startDate).format('DD-MM-YYYY');
            const formattedEndDate = moment(item.endDate).format('DD-MM-YYYY');

            // Extract product names from the populated productId array
            const productNames = item.productId.map(product => product.productName).join(', ');

            // Extract category names from the populated categoryId array
            const categoryNames = item.categoryId.map(category => category.name).join(', ');
console.log("......",categoryNames)
            return {
                ...item.toObject(),
                formattedStartDate,
                formattedEndDate,
                productNames: productNames || 'N/A', // Join product names if multiple products exist
                categoryNames: categoryNames || 'N/A', // Join category names if multiple categories exist
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
        console.log('Adding offer started');
        const { offerName, discount, startDate, endDate, offerType, productId, categoryId } = req.body;

        // Validate required fields
        if (!offerName || !discount || !startDate || !endDate || !offerType) {
            return res.status(400).json({ success: false, errorMessage: 'All fields are required' });
        }

        // Validate offer name
        if (offerName.trim().length < 3) {
            return res.status(400).json({ success: false, errorMessage: 'Offer name must be at least 3 characters long' });
        }

        // Validate discount
        if (isNaN(discount) || discount <= 0) {
            return res.status(400).json({ success: false, errorMessage: 'Discount must be a positive number' });
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        const now = new Date();

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, errorMessage: 'Invalid date format' });
        }

        if (start < now) {
            return res.status(400).json({ success: false, errorMessage: 'Start date cannot be in the past' });
        }

        if (start >= end) {
            return res.status(400).json({ success: false, errorMessage: 'Start date must be before end date' });
        }

        // Validate offer type
        if (!['Product', 'Category', 'Referral'].includes(offerType)) {
            return res.status(400).json({ success: false, errorMessage: 'Invalid offer type' });
        }

        const newOffer = new Offer({
            offerName,
            discount,
            startDate,
            endDate,
            offerType,
        });

        if (offerType === 'Product') {
            console.log('Processing product offer');
            if (!productId) {
                return res.status(400).json({ success: false, errorMessage: 'Product ID is required for Product offers' });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, errorMessage: 'Product not found' });
            }
            console.log("..fiurefuf...",product.salePrice)

            const discountedPrice = product.salePrice - discount;
            if (discountedPrice < 0) {
                return res.status(400).json({ success: false, errorMessage: 'Discount exceeds product sale price' });
            }
            console.log("disc",discountedPrice)

            await Product.findByIdAndUpdate(
                productId,
                {
                    $set: {
                        salePrice: discountedPrice,
                        productOfferId: newOffer._id,
                        productDiscount: discount,
                    },
                },
                { new: true }
            );

            console.log(`Product sale price updated to ${discountedPrice}`);
            newOffer.productId = productId;
        } else if (offerType === 'Category') {
            console.log('Processing category offer');
            if (!categoryId) {
                return res.status(400).json({ success: false, errorMessage: 'Category ID is required for Category offers' });
            }
            console.log(".....erfrefrwf.......",categoryId)
            const cat = await Category.findById({_id:categoryId})

            const categoryProducts = await Product.find({ category: cat.name });
            console.log("..........kjebfjhdv..",categoryProducts)
            if (!categoryProducts.length) {
                return res.status(404).json({ success: false, errorMessage: 'No products found for the category' });
            }

            for (const product of categoryProducts) {
                const discountedPrice = product.salePrice - discount;

                if (discountedPrice < 0) {
                    console.warn(`Skipping product ${product._id} due to excessive discount`);
                    continue;
                }

                await Product.findByIdAndUpdate(
                    product._id,
                    {
                        $set: {
                            salePrice: discountedPrice,
                            categoryOfferId: newOffer._id,
                            categoryDiscount: discount,
                        },
                    },
                    { new: true }
                );

                console.log(`Product ${product._id} sale price updated to ${discountedPrice}`);
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
        console.log('Entered deleting');
        const { offerId } = req.body;

        // Find the offer to delete
        const offer = await Offer.findById(offerId);

        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        if (offer.offerType === 'Product') {
            // If offer is for a product, update the product
            const product = await Product.findById(offer.productId);
            if (product) {
                if (product.regularPrice) {
                    await Product.findByIdAndUpdate(
                        offer.productId,
                        {
                            $unset: {
                                productOfferId: 1,
                                productDiscount: 1,
                            },
                            $set: { salePrice: product.regularPrice },
                        },
                        { new: true }
                    );
                    console.log(`Updated product ${product._id} salePrice to ${product.regularPrice}`);
                } else {
                    console.warn(`Product ${product._id} is missing regularPrice`);
                }
            } else {
                console.warn(`Product with ID ${offer.productId} not found`);
            }
        } else if (offer.offerType === 'Category') {
            // If offer is for a category, update all products in that category
            const catProducts = await Product.find({ category: offer.categoryId });
            for (const product of catProducts) {
                console.log(`Product ${product._id} has regularPrice: ${product.regularPrice}`);
                if (product.regularPrice) {
                    await Product.findByIdAndUpdate(
                        product._id,
                        {
                            $unset: {
                                categoryOfferId: 1,
                                categoryDiscount: 1,
                            },
                            $set: { salePrice: product.regularPrice },
                        },
                        { new: true }
                    );
                    console.log(`Updated product ${product._id} salePrice to ${product.regularPrice}`);
                } else {
                    console.warn(`Product ${product._id} is missing regularPrice`);
                }
            }
        }

        // Delete the offer from the database
        await Offer.deleteOne({ _id: offerId });

        res.status(200).json({ success: true, message: "Offer deleted successfully" });
    } catch (error) {
        console.log('Error in deleting the offer:', error);
        res.status(500).json({ success: false, message: "Error deleting offer: " + error.message });
    }
};

module.exports={
    offerPage,
    loadAddOffer,
    addOffer,
    deleteOffer
}