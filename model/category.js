const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    isListed: {
        type: Boolean,
        default: true
    },
    offerPrice: {
        type: Number,
        default: 0
    },
    categoryOffer: {
        type: Number,
        default: 0
    },
    Image: {
        type: [String],
        required: true, // Ensure at least one image exists
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
