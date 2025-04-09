const bcrypt = require('bcryptjs');
const User = require('../models/Users');

const registerUser = async (req, res) => {

    const { name, email, password} = req.body;

    try{
        let user = await User.findOne({email});
        
        if(user) return res.status(400).json({ msg: 'Email já registado' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();
        res.status(201).json({ 
            msg: 'Utilizador registado com sucesso.', 
            user: { id: user._id, name, email, plan: user.plan } 
          });
    }catch (error) {
        res.status(500).json({ msg: 'Erro no servidor ao criar o utilizador.', error: error.message });
    }
};

const updateUser = async (req, res) => {
    const { name, email, password } = req.body;
    const userId = req.params.id;
  
    try {
      let user = await User.findById(userId);
      if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' });
  
      if (name) user.name = name;
      if (email) user.email = email;
      if (password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
      }
  
      await user.save();
      res.json({ 
        msg: 'Utilizador atualizado', 
        user: { id: user._id, name: user.name, email: user.email, plan: user.plan } 
      });
    } catch (error) {
      res.status(500).json({ msg: 'Erro no servidor', error: error.message });
    }
  };

const deleteUser = async (req, res) => {
    const userId = req.params.id;

    try {
        const user = await User.findByIdAndDelete(userId);
        if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' });
    
        res.json({ msg: 'Utilizador eliminado' });
      } catch (error) {
        res.status(500).json({ msg: 'Erro no servidor', error: error.message });
      }
};

const changePassword = async (req, res) => {
  const userId = req.user.id;
  const { password } = req.body;

  try {
      if (!password || password.length < 6) {
          return res.status(400).json({ msg: 'A password deve ter pelo menos 6 caracteres' });
      }

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' });

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);

      await user.save();

      res.status(200).json({ msg: 'Password alterada com sucesso!' });
  } catch (error) {
      res.status(500).json({ msg: 'Erro no servidor', error: error.message });
  }
};

const updateUserPlan = async (req, res) => {
  const userId = req.user.id;
  const { plan } = req.body;

  try {
    if (!['freemium', 'premium'].includes(plan)) {
      return res.status(400).json({ msg: 'Plano inválido. Usa "freemium" ou "premium".' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' });

    user.plan = plan;
    await user.save();

    res.json({ 
      msg: 'Plano do utilizador atualizado com sucesso', 
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan } 
    });
  } catch (error) {
    res.status(500).json({ msg: 'Erro no servidor', error: error.message });
  }
};

const registerToken = async (req, res) => {
  const userId = req.user.id;
  const { token, platform, device_id } = req.body

  try{
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' });

    const existingToken = user.device_tokens.find(dt => dt.token === token)
    if(!existingToken){
        user.device_tokens.push({userId, token, platform, device_id })
    }else{
      existingToken.last_updated = Date.now();
    }
    
    await user.save();
    res.status(200).json({ message: 'Token registado com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao registar o token', details: error.message });
    }
};

module.exports= {
    registerUser,
    updateUser,
    deleteUser,
    changePassword,
    updateUserPlan,
    registerToken
};