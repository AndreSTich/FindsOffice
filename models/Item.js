module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Item', {
      title: DataTypes.STRING(100),
      description: DataTypes.TEXT,
      city: DataTypes.ENUM('Альметьевск', 'Казань', 'Москва', 'Санкт-Петербург'),
      location: DataTypes.STRING(100),
      date: DataTypes.DATE,
      photo_path: DataTypes.STRING(255),
      category: DataTypes.ENUM('драгоценность', 'электроника', 'документ', 'одежда', 'другое'),
      type: DataTypes.ENUM('found', 'lost'),
      status: DataTypes.ENUM('рассматривается', 'утеряна', 'найдена', 'возвращена', 'утилизирована'),
      storage_days: DataTypes.DATE
    }, {
      tableName: 'Items',
      timestamps: false,
      hooks: {
        beforeDestroy: async (item, options) => {
          await sequelize.models.Request.destroy({ where: { item_id: item.id } });
          await sequelize.models.Response.destroy({ where: { item_id: item.id } });
          await sequelize.models.Cancellation.destroy({ where: { item_id: item.id } });
        }
      }
    });
  };