const {Sequelize,Model,DataTypes} = require('sequelize');

class so_upload_header_tbl extends Model {
    static init(sequelize) {
        return super.init({
            id: {
                primaryKey: true,
                type: DataTypes.UUID
            },
            COMPANY_CODE: DataTypes.STRING,
            SO_CODE: DataTypes.STRING,
            ITEM_TYPE: DataTypes.STRING,
            SO_DATE: DataTypes.DATE,
            CUSTOMER_CODE: DataTypes.STRING,
            PARTICULAR: DataTypes.STRING,
            REF_EUPO: DataTypes.STRING,
            REF_CROSS: DataTypes.STRING,
            SO_AMT: DataTypes.STRING,
            STATUS: DataTypes.STRING,
            created_by: DataTypes.STRING,
            updated_by: DataTypes.STRING,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            sequelize,
            tableName:'so_upload_header_tbl',
            freezeTableName: true
        })
    }

    static associate (models) {
        this.user = this.hasOne(models.user_tbl,{
            foreignKey:'id',
            sourceKey:'created_by'
        })
    }
}

module.exports = so_upload_header_tbl;