// models/jv_detail.js
const {Model,Sequelize,DataTypes} = require('sequelize');

class jv_detail_tbl extends Model {
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
            },
            draft_bill_no: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ref_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            destination_port: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            delivery_location: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            principal: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            container_size: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            container_no: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            supplier_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            amount: {
                type: DataTypes.DECIMAL(18, 9),
                allowNull: false,
            },
            status: {
                type: DataTypes.ENUM('For Creation', 'For Reversal'),
                allowNull: false,
            },
            cr_number: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            actual_vendor: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            actual_charges: {
                type: DataTypes.DECIMAL(18, 9),
                allowNull: true,
            },
            jv_create_ref_no: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            created_by:{type: DataTypes.STRING(50)},
            updated_by:{type: DataTypes.STRING(50)},
            createdAt:Sequelize.DATE,
            updatedAt:Sequelize.DATE,
        }, 
        {
            tableName: 'jv_detail_tbl',
            freezeTableName:true,
            sequelize,
        })
    }
  
    static associate = (models) => {
        this.belongsTo(models.jv_header_tbl, {
            foreignKey: 'jv_ref_no',
            targetKey: 'jv_ref_no',
            as: 'header',
        });
  
        // // Optional: self-reference if you want to relate reversal details to original ones
        // this.belongsTo(models.jv_header_tbl, {
        //     foreignKey: 'jv_create_ref_no',
        //     targetKey: 'jv_ref_no',
        //     as: 'originalJV',
        //     });
    };
  
  };
  
  module.exports = jv_detail_tbl;