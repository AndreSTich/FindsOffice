require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const app = express();

// Настройка EJS
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Подключение к БД
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql'
  }
);

// Импорт модели
const Item = require('./models/Item')(sequelize, DataTypes);

// Маршрут для главной страницы
app.get('/', async (req, res) => {
  try {
    const items = await Item.findAll();
    res.render('index', { items });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});