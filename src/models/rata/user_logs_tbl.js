const {Sequelize,DataTypes,Model} = require('sequelize');

class user_logs_tbl extends Model {
    static init(sequelize) {
        return super.init({
            id:{
                primaryKey:true,
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4
            },
            fk_user_id: DataTypes.UUIDV4,
            login_time: DataTypes.DATE
        },
        {
            sequelize,
            tableName: 'user_logs_tbl',
            freezeTableName: true,
            timestamps:false
        })
    }
}

module.exports = user_logs_tbl;
