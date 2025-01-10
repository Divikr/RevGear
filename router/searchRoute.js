const express = require('express');
const route = express();


const Products = require('../model/product');

route.get('/api/search/suggestions', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json({ success: true, suggestions: [] });
        }

        const suggestions = await Products.find({
            $or: [
                { productName: { $regex: query, $options: 'i' } },
                { category: { $regex: query, $options: 'i' } }
            ],
            isBlocked: false
        })
            .select('productName category productImage salePrice')
            .limit(5)
            .lean(); 

        res.json({ success: true, suggestions: suggestions });
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        res.json({ success: false, suggestions: [], error: 'Internal server error' });
    }
});



module.exports = route;