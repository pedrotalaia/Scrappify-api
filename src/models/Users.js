const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String,},
  googleId: { type: String},
  plan: { type: String, enum: ['freemium', 'premium'], default: 'freemium' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);