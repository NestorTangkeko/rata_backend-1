const { Model, Sequelize, DataTypes} = require('sequelize');

class principal_tbl extends Model {
    static init (sequelize) {
        return super.init({
            principal_code:{
                primaryKey: true,
                type: DataTypes.STRING(50)
            },
            principal_name:{
                allowNull:false,
                type: DataTypes.STRING(50)
            },
            description:{
                type: DataTypes.STRING(255)
            },
            address:{
                type: DataTypes.STRING(255)
            },
            is_active:{
                type: DataTypes.INTEGER
            },
            ascii_principal_code:{
                type: DataTypes.STRING
            },
            ascii_customer_code:{
                type: DataTypes.STRING
            },
            created_date:{
                allowNull:false,
                type: Sequelize.DATE
            },
            modified_date:{
                allowNull:false,
                type: Sequelize.DATE
            }
        },
        {
            sequelize,
            freezeTableName:true,
            timestamps : false,
            tableName:'principal_tbl'
        })
    }


}

module.exports = principal_tbl