const { Sequelize,Model,DataTypes } = require('sequelize');

class vendor_group_tbl extends Model {
    static init(sequelize) {
        return super.init({
            vg_code:{
                primaryKey:true,
                type: DataTypes.STRING(50)
            },
            vg_desc:{
                type: DataTypes.STRING(255)
            },
            vg_status:{
                type: DataTypes.STRING(50)
            },
            location:{
                type: DataTypes.STRING(50)
            },
            createdAt: Sequelize.DATE,
            updatedAt: Sequelize.DATE,
            created_by: {
                type: DataTypes.STRING(50)
            },
            updated_by:{
                type: DataTypes.STRING(50)
            }
        },
        {
            sequelize,
            freezeTableName:true,
            tableName:'vendor_group_tbl'
        })
    }

    static async paginated({
        filters,
        order,
        page,
        totalPage
    }) {
        
        return await this.findAndCountAll({
            where:{
                ...filters
            },
            offset: parseInt(page) * parseInt(totalPage),
            limit:parseInt(totalPage),
            order
        })
    }
    
    static async getData ({options,where}) {
        return await this.findAll({
            where:{
                ...where
            },
            ...options
        })
        .then(result => JSON.parse(JSON.stringify(result)))
    }
}

module.exports = vendor_group_tbl;