module.exports = (sequelize, DataTypes) => {
    return sequelize.define('User', {
      login: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      role: {
        type: DataTypes.ENUM('сотрудник', 'администратор', 'пользователь'),
        defaultValue: 'пользователь'
      },
      last_name: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      first_name: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      phone: {
        type: DataTypes.STRING(20)
      }
    }, {
      tableName: 'Users',
      timestamps: false
    });
  };