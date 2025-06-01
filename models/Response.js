module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Response', {
      status: {
        type: DataTypes.ENUM('отправлено', 'рассматривается', 'одобрено', 'отклонено'),
        defaultValue: 'отправлено'
      },
      proof: DataTypes.TEXT,
      item_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      tableName: 'Responses',
      timestamps: false
    });
  };