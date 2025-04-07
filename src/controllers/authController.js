const bcrypt = require('bcryptjs');
const User = require('../models/Users');
const jwt = require('jsonwebtoken');

const loginUser = async (req, res) => {
    const { email, password } = req.body;
  
    console.log('JWT_SECRET:', process.env.JWT_SECRET);
  
    try {
      const user = await User.findOne({ email }); 
      if (!user) return res.status(400).json({ msg: 'Credenciais inválidas!' });
  
      const loginTest = await bcrypt.compare(password, user.password);
      if (!loginTest) return res.status(400).json({ msg: 'Credenciais inválidas!' });
  
      const token = jwt.sign({ id: user._id, name: user.name, email: user.email, plan: user.plan }, process.env.JWT_SECRET, { expiresIn: '1h' }); 
      res.json({ msg: 'Login bem-sucedido', token });
    } catch (error) {
      res.status(500).json({ msg: 'Erro no servidor', error: error.message });
    }
};

const googleCallback = (req, res) => {
    const token = jwt.sign(
      { id: req.user._id, plan: req.user.plan },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.redirect(`http://localhost:3000/auth/callback?token=${token}`);
  };

module.exports = {
    loginUser,
    googleCallback
};

