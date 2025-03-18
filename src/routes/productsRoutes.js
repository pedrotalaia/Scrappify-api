const express = require('express');
const { saveOrUpdateProduct, deleteProduct } = require('../controllers/productController');
const router = express.Router();

router.post('/save', saveOrUpdateProduct);
router.delete(':id', deleteProduct);

module.exports = router;