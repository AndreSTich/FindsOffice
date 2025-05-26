require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const app = express();
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
const session = require('express-session');
const bcrypt = require('bcrypt');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: msg => console.error(msg)
  }
);

const Item = require('./models/Item')(sequelize, DataTypes);
const Request = require('./models/Request')(sequelize, DataTypes);
const Response = require('./models/Response')(sequelize, DataTypes);
const Proof = require('./models/Proof')(sequelize, DataTypes);
const User = require('./models/User')(sequelize, DataTypes);

Item.hasMany(Request, { foreignKey: 'item_id' });
Request.belongsTo(Item, { foreignKey: 'item_id' });

Item.hasMany(Response, { foreignKey: 'item_id' });
Response.belongsTo(Item, { foreignKey: 'item_id' });

Response.hasMany(Proof, { foreignKey: 'response_id' });
Proof.belongsTo(Response, { foreignKey: 'response_id' });

User.hasMany(Request, { foreignKey: 'user_id' });
User.hasMany(Response, { foreignKey: 'user_id' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(async (req, res, next) => {
  if (req.session.userId) {
    res.locals.user = await User.findByPk(req.session.userId, {
      attributes: ['id', 'first_name', 'last_name', 'login', 'role']
    });
  }
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};


app.get('/', async (req, res) => {
  try {
    const items = await Item.findAll({
      where: {
        status: {
          [Sequelize.Op.not]: 'на рассмотрении'
        }
      }
    });

    res.render('index', { 
      items,
      user: res.locals.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/publish', requireAuth, async (req, res) => {
  res.render('publish', {
    isEdit: false,
    user: res.locals.user
  });
});

app.post('/publish', requireAuth, async (req, res) => {
  try {
    const { title, description, city, location, date, photo, category, type } = req.body;

    const item = await Item.create({
      title,
      description,
      city,
      location,
      date,
      photo_path: photo,
      category,
      type,
      status: 'на рассмотрении',
    });

    await Request.create({
      status: 'отправлено',
      item_id: item.id,
      user_id: req.session.userId
    });

    res.redirect('/');
  } catch (error) {
    console.error('Ошибка:', error.message);
    res.status(500).send(`Ошибка: ${error.message}`);
  }
});

app.get('/respond', requireAuth, async (req, res) => {
  try {
    const itemId = req.query.item_id;
    const item = await Item.findByPk(itemId);
    
    if (!item) {
      return res.status(404).send('Предмет не найден');
    }
    
    res.render('respond', { 
      item, 
      isEdit: false, 
      user: res.locals.user 
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

app.post('/respond', requireAuth, async (req, res) => {
  try {
    const { item_id, proof_text, proof_type, proof_file } = req.body;

    const response = await Response.create({
      item_id: parseInt(item_id),
      user_id: req.session.userId,
      status: 'отправлено',
      proof: proof_text
    });

    if (proof_type == "photo" || proof_type == "document") {
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

app.get('/requests', requireAuth, async (req, res) => {
  try {
    const requests = await Request.findAll({
      where: { user_id: req.session.userId },
      include: [{
        model: Item,
        required: true
      }]
    });

    res.render('requests', { 
      requests,
      user: res.locals.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/responses', requireAuth, async (req, res) => {
  try {
    const responses = await Response.findAll({
      where: { user_id: req.session.userId },
      include: [{
        model: Item,
        required: true
      }],
    });

    res.render('responses', { 
      responses,
      user: res.locals.user
    });
  } catch (error) {
    console.error('Ошибка при загрузке откликов:', error);
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/api/requests/:id', requireAuth, async (req, res) => {
  try {
    const request = await Request.findOne({
      where: { 
        id: req.params.id,
        user_id: req.session.userId // Проверяем, что заявка принадлежит пользователю
      },
      include: [{
        model: Item,
        attributes: ['id', 'title', 'city', 'location', 'description', 'photo_path', 'date']
      }]
    });

    if (!request) {
      return res.status(404).json({ error: 'Заявка не найдена или у вас нет доступа' });
    }

    res.json(request);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// API для получения отклика
app.get('/api/responses/:id', requireAuth, async (req, res) => {
  try {
    const response = await Response.findOne({
      where: { 
        id: req.params.id,
        user_id: req.session.userId // Проверяем, что отклик принадлежит пользователю
      },
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

    if (!response) {
      return res.status(404).json({ error: 'Отклик не найден или у вас нет доступа' });
    }

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// API для удаления заявки
app.delete('/api/requests/:id', requireAuth, async (req, res) => {
  try {
    const request = await Request.findOne({
      where: { 
        id: req.params.id,
        user_id: req.session.userId // Проверяем принадлежность заявки
      },
      include: [Item]
    });

    if (!request) {
      return res.status(404).json({ error: 'Заявка не найдена или у вас нет прав' });
    }

    if (request.Item && request.Item.status === 'на рассмотрении') {
      await Item.destroy({ where: { id: request.Item.id } });
    }
    await Request.destroy({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления заявки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для удаления отклика
app.delete('/api/responses/:id', requireAuth, async (req, res) => {
  try {
    const response = await Response.findOne({
      where: { 
        id: req.params.id,
        user_id: req.session.userId // Проверяем принадлежность отклика
      }
    });

    if (!response) {
      return res.status(404).json({ error: 'Отклик не найден или у вас нет прав' });
    }

    await Response.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления отклика:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Редактирование заявки
app.get('/edit-request/:id', requireAuth, async (req, res) => {
  try {
    const request = await Request.findOne({
      where: { 
        id: req.params.id,
        user_id: req.session.userId
      },
      include: [Item]
    });

    if (!request) {
      return res.status(404).send('Заявка не найдена или у вас нет прав');
    }

    res.render('publish', { 
      isEdit: true,
      request,
      user: res.locals.user // Используем пользователя из сессии
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// Обновление заявки
app.post('/update-request/:id', requireAuth, async (req, res) => {
  try {
    const request = await Request.findOne({
      where: { 
        id: req.params.id,
        user_id: req.session.userId
      },
      include: [Item]
    });

    if (!request) {
      return res.status(404).send('Заявка не найдена или у вас нет прав');
    }

    const { title, description, city, location, date, photo, existing_photo, category, type } = req.body;

    await request.Item.update({
      title,
      description,
      city,
      location,
      date,
      photo_path: photo || existing_photo,
      category,
      type,
      status: 'на рассмотрении'
    });

    res.redirect('/requests');
  } catch (error) {
    console.error('Ошибка при обновлении:', error);
    res.status(500).send('Ошибка при обновлении заявки');
  }
});

// Редактирование отклика
app.get('/edit-response/:id', requireAuth, async (req, res) => {
  try {
    const response = await Response.findOne({
      where: { 
        id: req.params.id,
        user_id: req.session.userId
      },
      include: [
        { model: Item },
        { model: Proof, as: 'Proofs' }
      ]
    });

    if (!response) {
      return res.status(404).send('Отклик не найден или у вас нет прав');
    }

    res.render('respond', { 
      isEdit: true,
      response: {
        ...response.get({ plain: true }),
        proof: response.proof || ''
      },
      item: response.Item,
      proofs: response.Proofs || [],
      user: res.locals.user // Используем пользователя из сессии
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// Обновление отклика
app.post('/edit-response/:id', requireAuth, async (req, res) => {
  try {
    const response = await Response.findOne({
      where: { 
        id: req.params.id,
        user_id: req.session.userId
      }
    });

    if (!response) {
      return res.status(404).send('Отклик не найден или у вас нет прав');
    }

    const { proof_text, proof_type, proof_file } = req.body;

    await Response.update(
      { proof: proof_text },
      { where: { id: req.params.id } }
    );

    if (proof_file) {
      const existingProof = await Proof.findOne({
        where: { response_id: req.params.id }
      });

      if (existingProof) {
        await Proof.update(
          {
            type: proof_type,
            file_path: proof_file
          },
          { where: { id: existingProof.id } }
        );
      } else {
        await Proof.create({
          response_id: req.params.id,
          type: proof_type,
          file_path: proof_file
        });
      }
    }

    res.redirect('/responses');
  } catch (error) {
    console.error('Ошибка при обновлении:', error);
    res.status(500).send('Ошибка при обновлении отклика');
  }
});

// Проверка отклика
app.get('/api/check-response', requireAuth, async (req, res) => {
  try {
    const { item_id } = req.query;
    
    const response = await Response.findOne({
      where: {
        item_id: parseInt(item_id),
        user_id: req.session.userId // Используем ID из сессии
      }
    });
    
    res.json({ hasResponded: !!response });
  } catch (error) {
    console.error('Ошибка при проверке отклика:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/login', (req, res) => {
  const showRegisterFields = req.query.register === 'true';
  res.render('login', { 
      title: showRegisterFields ? 'Регистрация' : 'Вход в систему',
      error: null,
      showRegisterFields: showRegisterFields,
      formData: {}
  });
});

app.post('/login', async (req, res) => {
  try {
      const { login, password } = req.body;
      const user = await User.findOne({ where: { login } });
      
      if (!user || !(await bcrypt.compare(password, user.password))) {
          return res.render('login', {
              title: 'Вход в систему',
              error: 'Неверный логин или пароль',
              showRegisterFields: false,
              formData: req.body
          });
      }
      
      req.session.userId = user.id;
      req.session.role = user.role;
      res.redirect('/');
  } catch (error) {
      res.render('login', {
          title: 'Вход в систему',
          error: 'Ошибка входа: ' + error.message,
          showRegisterFields: false,
          formData: req.body
      });
  }
});

app.post('/register', async (req, res) => {
  try {
      const { login, password, password_confirm, first_name, last_name, phone } = req.body;
      
      // Проверка на существующего пользователя
      const existingUser = await User.findOne({ where: { login } });
      if (existingUser) {
          return res.render('login', {
              title: 'Регистрация',
              error: 'Пользователь с таким логином уже существует',
              showRegisterFields: true,
              formData: req.body
          });
      }
      
      // Проверка совпадения паролей
      if (password !== password_confirm) {
          return res.render('login', {
              title: 'Регистрация',
              error: 'Пароли не совпадают',
              showRegisterFields: true,
              formData: req.body
          });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await User.create({
          login,
          password: hashedPassword,
          last_name,
          first_name,
          phone,
          role: 'пользователь'
      });
      
      req.session.userId = user.id;
      req.session.role = user.role;
      res.redirect('/');
  } catch (error) {
      res.render('login', {
          title: 'Регистрация',
          error: 'Ошибка регистрации: ' + error.message,
          showRegisterFields: true,
          formData: req.body
      });
  }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});