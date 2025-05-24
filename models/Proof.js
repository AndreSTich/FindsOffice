module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Proof', {
      type: {
        type: DataTypes.ENUM('photo', 'document'),
        allowNull: false
      },
      file_path: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      response_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      tableName: 'Proofs',
      timestamps: false
    });
  };