const bcrypt = require('bcryptjs');
const User = require('../models/Users');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Credenciais inválidas' });

    const loginTest = await bcrypt.compare(password, user.password);
    if (!loginTest) return res.status(400).json({ msg: 'Credenciais inválidas' });

    const token = jwt.sign({ id: user._id, name: user.name, email: user.email, profilePicture: user.profilePicture || null, plan: user.plan }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ msg: 'Início de sessão bem-sucedido', token });
  } catch (error) {
    res.status(500).json({ msg: 'Erro no servidor', erro: error.message });
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

const transporter = nodemailer.createTransport({
  host: 'smtp.mailtrap.io',
  port: 2525,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
const sendVerificationEmail = async (req, res) => {
  try {
    const email = req.user.email;

    if (!email) return res.status(400).json({ msg: 'Email é obrigatório' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' });

    if (user.isEmailVerified) return res.status(400).json({ msg: 'Email já verificado' });

    const verificationUrl = `http://localhost:5000/api/auth/verify-email?email=${encodeURIComponent(email)}`;

    await transporter.sendMail({
      to: email,
      from: process.env.EMAIL_USER,
      subject: 'Verifique o seu email',
      html: `
        <h1>Bem-vindo!</h1>
        <p>Por favor, clique no link abaixo para verificar o seu email:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
      `
    });

    res.json({ msg: 'Email de verificação enviado' });
  } catch (error) {
    res.status(500).json({ msg: 'Erro no servidor', erro: error.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) return res.status(400).json({ msg: 'Email é obrigatório' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' });

    if (user.isEmailVerified) return res.status(400).json({ msg: 'Email já verificado' });

    user.isEmailVerified = true;
    await user.save();

    return res.redirect('http://localhost:3000/verified');
  } catch (error) {
    res.status(500).json({ msg: 'Erro no servidor', erro: error.message });
  }
};

module.exports = {
  loginUser,
  googleCallback,
  sendVerificationEmail,
  verifyEmail
};