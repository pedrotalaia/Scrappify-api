const express = require('express');
const auth = require('../middleware/auth');
const { countFavorite, addFavorite, listFavorites, removeFavorite, updateFavorite } = require('../controllers/FavoriteController');
const { getUserNotifications, markNotificationRead } = require('../controllers/alertController');

const router = express.Router();

router.get('/count', auth, countFavorite);
router.post('/', auth, addFavorite);
router.get('/', auth, listFavorites);
router.delete('/:id', auth, removeFavorite);
router.put('/:id', auth, updateFavorite);

//NOTIFICAÇOES
router.get('/notifications', auth, getUserNotifications);
router.put('/notifications/:id/mark-read', auth, markNotificationRead);


module.exports = router;