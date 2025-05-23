require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); // Для обработки данных формы

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql'
  }
);

const Item = require('./models/Item')(sequelize, DataTypes);
const Request = require('./models/Request')(sequelize, DataTypes);

// Главная страница (показывает только одобренные заявки)
app.get('/', async (req, res) => {
  try {
    const items = await Item.findAll({
      where: {
        status: {
          [Sequelize.Op.not]: 'на рассмотрении'
        }
      }
    });
    res.render('index', { items });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/publish', (req, res) => {
  res.render('publish');
});

app.post('/publish', async (req, res) => {
  try {
    const { title, description, city, location, date, photo, category, type } = req.body;

    const photo_path = photo ? photo.replace(/\\/g, '/') : null;

    const item = await Item.create({
      title,
      description,
      city,
      location,
      date,
      photo_path,
      category,
      type,
      status: 'на рассмотрении',
    });

    await Request.create({
      status: 'отправлено',
      item_id: item.id,
      user_id: 1
    });

    res.redirect('/');
  } catch (error) {
    console.error('Ошибка:', error.message);
    res.status(500).send(`Ошибка: ${error.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});