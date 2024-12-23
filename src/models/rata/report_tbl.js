const {Sequelize,Model,DataTypes} = require('sequelize')

class report_tbl extends Model{
    static init (sequelize) {
        return super.init({
            id:{
                allowNull: false,
                primaryKey: true,
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4   
            },
            report_id:{
                type: DataTypes.STRING
            },
            report_status:{
                type: DataTypes.STRING
            },
            err_message:{
                type: DataTypes.STRING
            },
            file_name:{
                type: DataTypes.STRING
            },
            file_path:{
                type: DataTypes.STRING
            },
            transaction_date: {
                type: DataTypes.STRING
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
            created_by: {
                type: DataTypes.STRING
            },
            updated_by: {
                type: DataTypes.STRING
            }
        },
        {
            sequelize,
            tableName:'report_tbl',
            freezeTableName:true,
        })
    }

    static associate(models) {
        this.report_header = this.hasOne(models.report_schedule_tbl,{
            sourceKey:'report_id',
            foreignKey:'id'
        })
    }
}

module.exports = report_tbl;