const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const passport = require('./config/passport');
const routes = require('./routes');
const cors = require('cors');
const { scrapeAmazonQuery } = require('./utils/scrapers');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(passport.initialize());

app.use('/api', routes);

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('Base de Dados conectada'))
  .catch(err => console.log('Erro no MongoDB:', err));

scrapeAmazonQuery('Apple AirPods Pro 2');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));