const { Model, DataTypes } = require('sequelize');

class so_upload_details_tbl extends Model {
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.UUIDV1,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            fk_header_id: {
                type: DataTypes.CHAR(36),
            },
            COMPANY_CODE: {
                type: DataTypes.STRING(36),
            },
            SO_CODE: {
                type: DataTypes.STRING(36),
                },
                ITEM_CODE: {
                type: DataTypes.STRING(36),
                },
                LINE_NO: {
                type: DataTypes.STRING(36),
                },
                LOCATION_CODE: {
                type: DataTypes.STRING(36),
                },
                UM_CODE: {
                type: DataTypes.STRING(36),
                },
                QUANTITY: {
                type: DataTypes.DECIMAL(18, 2),
                },
                UNIT_PRICE: {
                type: DataTypes.DECIMAL(18, 2),
                },
                EXTENDED_AMT: {
                type: DataTypes.DECIMAL(18, 2),
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
                }
        },
        {
            sequelize,
            tableName: 'so_upload_details_tbl',
            freezeTableName:true
        })
    }
}



module.exports = so_upload_details_tbl;

// const { Model, DataTypes } = require('sequelize');
// const sequelize = require('../config/database'); // Make sure to adjust the path to your sequelize instance

// class SoUploadDetailsTbl extends Model {}

// SoUploadDetailsTbl.init({
// }, {
//   sequelize,
//   modelName: 'so_upload_details_tbl',
//   tableName: 'so_upload_details_tbl',
//   timestamps: false, // Assuming the table does not follow the convention of automatically managed timestamps
// });

// module.exports = SoUploadDetailsTbl;
