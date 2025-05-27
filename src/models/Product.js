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

const ProductViewSchema = new Schema({
    date: { type: Date, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    deviceId: { type: String },
    count: { type: Number, default: 1 }
}, { _id: false });

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
    parentId: { type: Schema.Types.ObjectId, ref: 'Product' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    viewsByDate: {
        type: [ProductViewSchema],
        default: [],
        validate: {
            validator: function (arr) {
                return arr.every(v => v.date instanceof Date && typeof v.count === 'number');
            },
            message: 'viewsByDate contém dados inválidos'
        }
    }
});

ProductSchema.index(
    { brand: 1, model: 1, memory: 1, color: 1 },
    {
        unique: true,
        collation: { locale: 'en', strength: 2 }
    }
);

module.exports = mongoose.model('Product', ProductSchema);