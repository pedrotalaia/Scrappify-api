const bcrypt = require('bcryptjs');
const User = require('../models/Users');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const jwt = require('jsonwebtoken');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const registerUser = async (req, res) => {
    const { name, email, password, birthDate, gender } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'Email já registado' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name,
            email,
            password: hashedPassword,
            birthDate: birthDate ? new Date(birthDate) : undefined,
            gender
        });

        await user.save();
        res.status(201).json({
            msg: 'Utilizador registado com sucesso.',
            user: {
                id: user._id,
                name,
                email,
                plan: user.plan
            }
        });
    } catch (error) {
        res.status(500).json({ msg: 'Erro no servidor ao criar o utilizador.', error: error.message });
    }
};

const updateUser = async (req, res) => {
    const { name, email, password, birthDate, gender } = req.body;
    const userId = req.params.id;

    try {
        let user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' });

        if (name) user.name = name;
        if (email) user.email = email;
        if (birthDate) user.birthDate = new Date(birthDate);
        if (gender) user.gender = gender;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        await user.save();
        res.json({
            msg: 'Utilizador atualizado',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                birthDate: user.birthDate,
                gender: user.gender
            }
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

const updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;


    if (!file) {
      return res.status(400).json({ error: 'Fotografia é obrigatória!' });
    }
    const filetypes = /jpeg|jpg|png/;
    if (!filetypes.test(file.mimetype)) {
      return res.status(400).json({ error: 'Apenas imagens JPEG ou PNG são permitidas' });
    }
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'O arquivo deve ter no máximo 10MB' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' })

    const formData = new FormData();
    formData.append('feature', 'profile_picture');
    formData.append('relationId', userId);
    formData.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const response = await axios.post('https://aws-s3-wolf-service.vercel.app/api/aws/save', formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Basic ${Buffer.from('scrapify:Viana@2025').toString('base64')}`,
      },
    });

    const imageUrl = response.data.url;
    const imageKey = response.data.key; 

    user.profilePicture = imageUrl;
    user.profilePictureKey = imageKey;
    await user.save();

    const tokenPayload = {
      id: user._id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture, 
      plan: user.plan, 
    };
    const newToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({
      message: 'Foto de perfil atualizada com sucesso',
      user: { id: user._id, name: user.name, email: user.email, profilePicture: user.profilePicture },
      token: newToken,
    });
  } catch (error) {
    console.error('Erro ao atualizar foto de perfil:', error.message);
    res.status(500).json({ error: 'Erro ao atualizar foto de perfil', details: error.message });
  }
};

module.exports= {
    registerUser,
    updateUser,
    deleteUser,
    changePassword,
    updateUserPlan,
    registerToken,
    updateProfilePicture,
    upload
};