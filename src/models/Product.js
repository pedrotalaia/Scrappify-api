const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductPriceSchema = new Schema({
    value: { type: Number, required: true },
    date: { type: Date, default: Date.now }
});

const ProductOfferSchema = new Schema({
    source: { type: String, required: true }, 
    url: { type: String, required: true },
    prices: [ProductPriceSchema],
    lastUpdated: { type: Date, default: Date.now }
});

const ProductSchema = new Schema({
    brand: { type: String, required: true },
    model: { type: String, required: true, index: true }, 
    memory: { type: String },
    color: { type: String }, 
    name: { type: String, required: true },
    category: { type: String },
    currency: { type: String, default: 'EUR' },
    imageUrl: { type: String },
    offers: [ProductOfferSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ProductSchema.index({ brand: 1, model: 1, memory: 1, color: 1 }, { unique: true });

module.exports = mongoose.model('Product', ProductSchema);