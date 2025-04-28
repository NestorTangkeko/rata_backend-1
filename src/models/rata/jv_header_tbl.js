const {Model,Sequelize,DataTypes} = require('sequelize');

class jv_header_tbl extends Model {
    static init (sequelize) {
        return super.init({
            id:{
                allowNull: false,
                primaryKey: true,
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4
            },
            jv_ref_no: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            total_amount: {
                type: DataTypes.DECIMAL(18, 9),
                allowNull: false,
            },
            cost_center: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            location: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            service_type: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            department_code: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            status: {
                type: DataTypes.ENUM('For Creation', 'For Reversal'),
                allowNull: false,
            },
            created_by:{type: DataTypes.STRING(50)},
            updated_by:{type: DataTypes.STRING(50)},
            createdAt:Sequelize.DATE,
            updatedAt:Sequelize.DATE,
        }, 
        {
            tableName: 'jv_header_tbl',
            freezeTableName:true,
            sequelize,
        })
    }
  
    static associate = (models) => {
        this.hasMany(models.jv_detail_tbl, {
            foreignKey: 'jv_ref_no',
            sourceKey: 'jv_ref_no',
            as: 'details',
        });
    };
  
};


module.exports = jv_header_tbl;