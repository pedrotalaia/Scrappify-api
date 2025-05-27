const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserDevice_TokensSchema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  platform: { type: String, required: true },
  device_id: { type: String },
  last_updated: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },
  plan: { type: String, enum: ['freemium', 'premium'], default: 'freemium' },
  device_tokens: [UserDevice_TokensSchema],
  isEmailVerified: { type: Boolean, default: false },
  profilePicture: { type: String },
  profilePictureKey: { type: String },
  birthDate: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);