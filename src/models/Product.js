const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  source: { type: String, required: true }, 
  url: { type: String, required: true },
  prices: [{
    value: { type: Number, required: true },
    date: { type: Date, default: Date.now }
  }],
  category: { type: String, required: false },
  currency: { type: String, required: true }, 
  imageUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);