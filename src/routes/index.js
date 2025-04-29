const express = require('express');
const usersRoutes = require('./usersRoutes');
const productsRoutes = require('./productsRoutes');
const authRoutes = require('./authRoutes');
const favoritesRoutes = require('./favoritesRoutes');

const router = express.Router();

router.use('/users', usersRoutes);
router.use('/products', productsRoutes);
router.use('/auth', authRoutes);
router.use('/favorites', favoritesRoutes);

module.exports = router;