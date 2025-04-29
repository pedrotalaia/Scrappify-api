const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ALERT_TYPES = [
    'price_changed', 'price_dropped', 'price_increased',
    'price_dropped_percent', 'price_increased_percent',
    'price_below', 'price_above', 'price_change_absolute',
    'stock_available', 'price_historic_low'
];

const AlertSchema = new Schema({
    type: { type: String, required: true, enum: ALERT_TYPES },
    value: { type: Number }
});

const AlertHistorySchema = new Schema({
    alerts: [AlertSchema],
    updatedAt: { type: Date, default: Date.now }
});

const FavoriteSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    offerId: { type: Schema.Types.ObjectId },
    alerts: [AlertSchema],
    alertsHistory: [AlertHistorySchema],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Favorite', FavoriteSchema);