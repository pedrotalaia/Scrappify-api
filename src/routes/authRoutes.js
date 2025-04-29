const express = require('express');
const { loginUser, googleCallback, sendVerificationEmail, verifyEmail } = require('../controllers/authController');
const passport = require('../config/passport');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/login', loginUser);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { session: false }), googleCallback);

router.post('/send-verification-email', auth, sendVerificationEmail);
router.get('/verify-email', verifyEmail);


module.exports = router;