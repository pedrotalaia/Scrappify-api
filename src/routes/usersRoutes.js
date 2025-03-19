const express = require('express');
const { registerUser, deleteUser, updateUser, loginUser } = require('../controllers/userController');
const router = express.Router();

router.post('/register', registerUser);
router.put('/:id', updateUser)
router.delete('/:id', deleteUser);
router.post('/login', loginUser);

module.exports = router;