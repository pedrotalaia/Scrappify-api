const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const passport = require('./config/passport');
const routes = require('./routes');
const cors = require('cors');
const admin = require('firebase-admin');
const { scrapeProductPriceByQuery } = require('./scrapper');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(passport.initialize());

app.use('/api', routes);

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('Base de Dados conectada'))
  .catch(err => console.log('Erro no MongoDB:', err));

if (admin.apps.length > 0) {
  console.log('Firebase Admin SDK inicializado com sucesso');
} else {
  console.error('Erro: Firebase Admin SDK não foi inicializado');
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));