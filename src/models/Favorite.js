const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: [
      'price_changed', 'price_dropped', 'price_increased',
      'price_dropped_percent', 'price_increased_percent',
      'price_below', 'price_above', 'price_change_absolute',
      'stock_available', 'price_historic_low'
    ], 
    required: true 
  },
  value: { type: Number }
});

const favoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  alerts: [alertSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Favorite', favoriteSchema);