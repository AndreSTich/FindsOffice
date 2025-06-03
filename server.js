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
const Cancellation = require('./models/Cancellation')(sequelize, DataTypes);

Item.hasMany(Request, { foreignKey: 'item_id' });
Request.belongsTo(Item, { foreignKey: 'item_id' });

Item.hasMany(Response, { foreignKey: 'item_id' });
Response.belongsTo(Item, { foreignKey: 'item_id' });
Response.belongsTo(User, { foreignKey: 'user_id' });

Response.hasMany(Proof, { foreignKey: 'response_id' });
Proof.belongsTo(Response, { foreignKey: 'response_id' });

User.hasMany(Request, { foreignKey: 'user_id' });
User.hasMany(Response, { foreignKey: 'user_id' });

Item.hasMany(Cancellation, { foreignKey: 'item_id' });
Cancellation.belongsTo(Item, { foreignKey: 'item_id' });

User.hasMany(Cancellation, { foreignKey: 'employee_id' });
Cancellation.belongsTo(User, { foreignKey: 'employee_id' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
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
    const user = req.session.userId ? await User.findByPk(req.session.userId) : null;
    
    const whereCondition = {};
    
    if (!user || user.role === 'пользователь') {
      whereCondition.status = {
        [Sequelize.Op.or]: ['найдена', 'утеряна']
      };
    }

    const items = await Item.findAll({
      where: whereCondition,
      order: [['date', 'DESC']]
    });

    res.render('index', { 
      items,
      user: user
    });
  } catch (error) {
    console.error('Ошибка при загрузке главной страницы:', error);
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
      status: 'рассматривается',
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
    const user = await User.findByPk(req.session.userId);
    const isEmployee = user.role === 'сотрудник' || user.role === 'администратор';
    const statusFilter = req.query.status;

    const whereCondition = isEmployee ? {} : { user_id: req.session.userId };

    const requestWhere = {...whereCondition};
    if (statusFilter && statusFilter !== 'all') {
      requestWhere.status = statusFilter;
    }

    const requests = await Request.findAll({
      where: requestWhere,
      include: [{
        model: Item,
        required: true
      }],
    });

    res.render('requests', { 
      requests,
      user: user,
      isEmpl: isEmployee
    });
  } catch (error) {
    console.error('Ошибка при загрузке заявок:', error);
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

    if (request.Item && request.Item.status === 'рассматривается') {
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
      status: 'рассматривается'
    });

    await Request.update(
      { status: 'отправлено' },
      { where: { id: req.params.id } }
    );

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

    const updatedResponse = await Response.findOne({
      where: { id: req.params.id },
      include: [
        { model: Item },
        { model: Proof, as: 'Proofs' }
      ]
    });

    res.render('respond', { 
      isEdit: true,
      response: {
        ...updatedResponse.get({ plain: true }),
        proof: updatedResponse.proof || ''
      },
      item: updatedResponse.Item,
      proofs: updatedResponse.Proofs || [],
      user: res.locals.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

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
      { proof: proof_text,
        status: 'отправлено'},
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
    
    if (user.role === 'администратор') {
      return res.redirect('/users');
    }
    
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

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Ошибка при выходе:', err);
    }
    res.redirect('/');
  });
});


const requireAdmin = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.role !== 'администратор') {
    return res.status(403).send('Доступ запрещен');
  }
  next();
};

app.get('/users', requireAdmin, async (req, res) => {
  try {
    const { search, role } = req.query;
    const where = {};
    
    if (search) {
      where[Sequelize.Op.or] = [
        { first_name: { [Sequelize.Op.iLike]: `%${search}%` } },
        { last_name: { [Sequelize.Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (role && role !== 'all') {
      where.role = role;
    }
    
    const users = await User.findAll({
      attributes: ['id', 'first_name', 'last_name', 'phone', 'role'],
      where,
      order: [['id', 'ASC']]
    });
    
    res.render('users', { users });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

app.put('/api/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'Вы не можете изменить свою роль' });
    }
    
    await User.update({ role }, { where: { id } });
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/responses', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    const isEmployee = user.role === 'сотрудник' || user.role === 'администратор';
    const statusFilter = req.query.status;

    const whereCondition = isEmployee ? {} : { user_id: req.session.userId };

    const responseWhere = {...whereCondition};
    if (statusFilter && statusFilter !== 'all') {
      responseWhere.status = statusFilter;
    }

    const responses = await Response.findAll({
      where: responseWhere,
      include: [{
        model: Item,
        required: true
      }],
    });

    res.render('responses', { 
      responses,
      user: user,
      isEmpl: isEmployee
    });
  } catch (error) {
    console.error('Ошибка при загрузке откликов:', error);
    res.status(500).send('Ошибка сервера');
  }
});

app.put('/api/responses/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['отправлено', 'рассматривается', 'одобрено', 'отклонено'];
    
    const response = await Response.findByPk(id, {
      include: [Item]
    });

    if (!response) {
      return res.status(404).json({ error: 'Отклик не найден' });
    }

    const user = await User.findByPk(req.session.userId);
    const isEmployee = user.role === 'сотрудник' || user.role === 'администратор';
    
    if (!isEmployee) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    await Response.update({ status }, { where: { id } });
    
    if (status === 'одобрено') {
      await Item.update(
        { status: 'возвращена' },
        { where: { id: response.item_id } }
      );
    } else if (status === 'отклонено') {
      const newStatus = response.Item.type === 'found' ? 'найдена' : 'утеряна';
      await Item.update(
        { status: newStatus },
        { where: { id: response.item_id } }
      );
    }

    const updatedResponse = await Response.findByPk(id, {
      include: [Item]
    });
    
    res.json({ 
      success: true,
      status: updatedResponse.status,
      item: updatedResponse.Item
    });
  } catch (error) {
    console.error('Ошибка при изменении статуса:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/responses/:id', requireAuth, async (req, res) => {
  try {
    const response = await Response.findOne({
      where: { id: req.params.id },
      include: [Item, Proof]
    });
    if (!response) return res.status(404).json({ error: "Отклик не найден" });
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.put('/api/requests/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;
    const allowedStatuses = ['отправлено', 'рассматривается', 'одобрено', 'отклонено'];
    
    const request = await Request.findByPk(id, {
      include: [Item]
    });

    if (!request) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const user = await User.findByPk(req.session.userId);
    const isEmployee = user.role === 'сотрудник' || user.role === 'администратор';
    
    if (!isEmployee) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const updateData = { status };
    if (status === 'отклонено' && comment) {
      updateData.comment = comment;
    }

    await Request.update(updateData, { where: { id } });
    
    if (status === 'одобрено') {
      const newItemStatus = request.Item.type === 'lost' ? 'утеряна' : 'найдена';
      await Item.update(
        { status: newItemStatus },
        { where: { id: request.item_id } }
      );
    } else if (status === 'отклонено') {
      await Item.update(
        { status: 'рассматривается' },
        { where: { id: request.item_id } }
      );
    }

    const updatedRequest = await Request.findByPk(id, {
      include: [Item]
    });
    
    res.json({ 
      success: true,
      status: updatedRequest.status,
      comment: updatedRequest.comment,
      item: updatedRequest.Item
    });
  } catch (error) {
    console.error('Ошибка при изменении статуса заявки:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    res.json(item);
  } catch (error) {
    console.error('Ошибка при получении данных о предмете:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/res-items/:id', async (req, res) => {
  try {
    const temp = await Response.findByPk(req.params.id);
    const item = await Item.findByPk(temp.item_id);
    if (!item) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    res.json(item);
  } catch (error) {
    console.error('Ошибка при получении данных о предмете:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/req-items/:id', async (req, res) => {
  try {
    const temp = await Request.findByPk(req.params.id);
    const item = await Item.findByPk(temp.item_id);
    if (!item) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    res.json(item);
  } catch (error) {
    console.error('Ошибка при получении данных о предмете:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


app.get('/disposal', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    if (user.role !== 'сотрудник' && user.role !== 'администратор') {
      return res.status(403).send('Доступ запрещен');
    }

    const filter = req.query.filter || 'Невостребованные вещи'; // Получаем параметр фильтра

    let items;
    if (filter === 'Утилизированные вещи') {
      // Запрос для утилизированных вещей
      items = await Item.findAll({
        where: { status: 'утилизирована' },
        include: [{
          model: Cancellation,
          include: [{ 
            model: User,
            attributes: ['first_name', 'last_name'] 
          }]
        }],
        order: [['storage_days', 'ASC']]
      });
    } else {
      // Запрос для невостребованных вещей
      items = await Item.findAll({
        where: {
          storage_days: { [Sequelize.Op.lt]: new Date() },
          status: { [Sequelize.Op.not]: ['рассматривается', 'утилизирована'] }
        },
        order: [['storage_days', 'ASC']]
      });
    }

    res.render('disposal', { 
      items, 
      user,
      currentFilter: filter // Передаем текущий фильтр в шаблон
    });
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).send('Ошибка сервера');
  }
});

app.post('/api/items/:id/utilize', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    if (user.role !== 'сотрудник' && user.role !== 'администратор') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { reason } = req.body;
    
    await Item.update(
      { status: 'утилизирована' },
      { where: { id: req.params.id } }
    );

    await Cancellation.create({
      item_id: req.params.id,
      employee_id: req.session.userId,
      reason: reason,
      date: new Date()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/stats', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    if (user.role !== 'администратор') {
      return res.status(403).send('Доступ запрещен');
    }

    const stats = {
      items: await Item.count(),
      responses: await Response.count(),
      requests: await Request.count(),
      foundItems: await Item.count({ where: { type: 'found' } }),
      lostItems: await Item.count({ where: { type: 'lost' } }),
      returnedItems: await Item.count({ where: { status: 'возвращена' } }),
      utilizedItems: await Item.count({ where: { status: 'утилизирована' } }),
      users: await User.count(),
      employees: await User.count({ where: { role: 'сотрудник' } }),
      admins: await User.count({ where: { role: 'администратор' } })
    };

    res.render('stats', { stats, user });
  } catch (error) {
    console.error('Ошибка при загрузке статистики:', error);
    res.status(500).send('Ошибка сервера');
  }
});

app.delete('/api/items/:id/delete', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    
    if (user.role !== 'администратор' && user.role !== 'сотрудник') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const item = await Item.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Вещь не найдена' });
    }

    await Request.destroy({ where: { item_id: item.id } });
    await Response.destroy({ where: { item_id: item.id } });
    await Cancellation.destroy({ where: { item_id: item.id } });

    await item.destroy();

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при удалении вещи:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});