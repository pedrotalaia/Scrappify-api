const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const routes = require('./routes');

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api', routes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Base de Dados conectada'))
  .catch(err => console.log('Erro no MongoDB:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));