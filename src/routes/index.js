const express = require('express');
const usersRoutes = require('./usersRoutes');
const productsRoutes = require('./productsRoutes');

const router = express.Router();

router.use('/users', usersRoutes);
router.use('/products', productsRoutes);

module.exports = router;