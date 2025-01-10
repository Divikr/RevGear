const mongoose = require('mongoose');

// Transaction Schema for each transaction in the wallet
const transactionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'], // 'credit' for adding funds, 'debit' for spending
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
   
});

// Wallet Schema
const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    balance: {
        type: Number,
        default: 0 // Set default balance to 0 when wallet is created
    },
    transactions: [transactionSchema], // Array of transactions
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Update the lastUpdated field when saving the wallet
walletSchema.pre('save', function(next) {
    this.lastUpdated = Date.now();
    next();
});

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;
