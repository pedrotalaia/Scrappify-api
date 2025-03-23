const express = require('express');
const { loginUser, googleCallback } = require('../controllers/authController');
const passport = require('../config/passport');

const router = express.Router();

router.post('/login', loginUser);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { session: false }), googleCallback);


module.exports = router;