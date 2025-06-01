module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Request', {
    status: {
      type: DataTypes.ENUM('отправлено', 'рассматривается', 'одобрено', 'отклонено'),
      defaultValue: 'отправлено'
    },
    user_id: { 
      type: DataTypes.INTEGER,
      allowNull: false 
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    comment: DataTypes.TEXT
  }, {
    tableName: 'Requests',
    timestamps: false
  });
};