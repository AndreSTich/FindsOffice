require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

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
const Response = require('./models/Response')(sequelize, DataTypes);
const Proof = require('./models/Proof')(sequelize, DataTypes);
const User = require('./models/User')(sequelize, DataTypes);

// Установка ассоциаций
Item.hasMany(Request, { foreignKey: 'item_id' });
Request.belongsTo(Item, { foreignKey: 'item_id' });

Item.hasMany(Response, { foreignKey: 'item_id' });
Response.belongsTo(Item, { foreignKey: 'item_id' });

Response.hasMany(Proof, { foreignKey: 'response_id' });
Proof.belongsTo(Response, { foreignKey: 'response_id' });

User.hasMany(Request, { foreignKey: 'user_id' });
User.hasMany(Response, { foreignKey: 'user_id' });

app.get('/', async (req, res) => {
  try {
    const items = await Item.findAll({
      where: {
        status: {
          [Sequelize.Op.not]: 'на рассмотрении'
        }
      }
    });

    const user = await User.findByPk(1, {
      attributes: ['first_name', 'last_name', 'login', 'role']
    });

    if (!user) {
      return res.status(500).send('Пользователь не найден');
    }

    res.render('index', { 
      items,
      user: {
        firstName: user.first_name,
        lastName: user.last_name,
        login: user.login,
        role: user.role
      }
    });
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
    const { title, description, city, location, date, category, type } = req.body;

    const item = await Item.create({
      title,
      description,
      city,
      location,
      date,
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

app.get('/respond', async (req, res) => {
  try {
    const itemId = req.query.item_id;
    const item = await Item.findByPk(itemId);
    if (!item) {
      return res.status(404).send('Предмет не найден');
    }
    res.render('respond', { item });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

app.post('/respond', async (req, res) => {
  try {
    const { item_id, proof_text, proof_type, proof_file } = req.body;

    const response = await Response.create({
      item_id: parseInt(item_id),
      user_id: 1,
      status: 'отправлено',
      proof: proof_text
    });

    if (proof_type == "Фото" || proof_type == "Документ"){
      await Proof.create({
        response_id: response.id,
        type: proof_type,
        file_path: proof_file
      });
    }

    res.redirect('/');
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).send('Произошла ошибка при обработке отклика');
  }
});

app.get('/requests', async (req, res) => {
  try {
    const userId = 1; 
    
    const requests = await Request.findAll({
      where: { user_id: userId },
      include: [{
        model: Item,
        required: true
      }]
    });

    res.render('requests', { 
      requests,
      user: {
        firstName: "Маша", 
        lastName: "Растеряша",
        login: "login"
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/responses', async (req, res) => {
  try {
    const userId = 1;
    
    const responses = await Response.findAll({
      where: { user_id: userId },
      include: [{
        model: Item,
        required: true
      }],
    });

    res.render('responses', { 
      responses,
      user: {
        firstName: "Маша", 
        lastName: "Растеряша",
        login: "login"
      }
    });
  } catch (error) {
    console.error('Ошибка при загрузке откликов:', error);
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/api/requests/:id', async (req, res) => {
  try {
    const request = await Request.findByPk(req.params.id, {
      include: [{
        model: Item,
        attributes: ['id', 'title', 'city', 'location', 'description', 'photo_path', 'date']
      }]
    });
    res.json(request);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/responses/:id', async (req, res) => {
  try {
    const response = await Response.findByPk(req.params.id, {
      include: [
        {
          model: Item,
          attributes: ['id', 'title', 'city', 'location', 'description', 'photo_path', 'date']
        },
        {
          model: Proof,
          attributes: ['id', 'file_path', 'type']
        }
      ]
    });
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  try {
    await sequelize.authenticate();
    console.log('Подключение к БД успешно');
    await sequelize.sync();
  } catch (error) {
    console.error('Ошибка подключения к БД:', error);
  }
});