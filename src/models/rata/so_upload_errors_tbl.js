const {Model, DataTypes} = require('sequelize');

class so_upload_errors_tbl extends Model {
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
              },
              fk_header_id: {
                type: DataTypes.CHAR(36),
              },
              ref_code: {
                type: DataTypes.STRING(68),
              },
              result_type: {
                type: DataTypes.ENUM('HEADER', 'DETAILS'),
              },
              field_name: {
                type: DataTypes.STRING(68),
              },
              field_value: {
                type: DataTypes.STRING(255),
              },
              message: {
                type: DataTypes.STRING(255),
              },
              response_code: {
                type: DataTypes.STRING(8),
              },
              created_by: {
                type: DataTypes.CHAR(36),
              },
              updated_by: {
                type: DataTypes.CHAR(36),
              },
              createdAt: {
                type: DataTypes.DATE,
              },
              updatedAt: {
                type: DataTypes.DATE,
              },
        },
        {
            sequelize,
            tableName:'so_upload_errors_tbl',
            freezeTableName:true
        })
    }

    static associate (models) {
      this.user = this.hasOne(models.user_tbl,{
          foreignKey:'id',
          sourceKey:'created_by'
      })
  }
}

module.exports = so_upload_errors_tbl;