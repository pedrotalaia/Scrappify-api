const bcrypt = require('bcryptjs');
const User = require('../models/Users');

const registerUser = async (req, res) => {

    const { name, email, password} = req.body;

    try{
        let user = await User.findOne({email});
        
        if(user) return res.status(400).json({ msg: 'Email já registrado' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();
        res.status(201).json({ 
            msg: 'Utilizador registrado com sucesso.', 
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
module.exports= {
    registerUser,
    updateUser,
    deleteUser
};