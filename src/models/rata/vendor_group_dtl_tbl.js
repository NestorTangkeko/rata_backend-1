const { Sequelize,Model,DataTypes } = require('sequelize');

class vendor_group_dtl_tbl extends Model {
    static init(sequelize){
        return super.init({
            vg_code:{
                primaryKey:true,
                type: DataTypes.STRING(50)
            },
            vg_vendor_id:{
                primaryKey:true,
                type: DataTypes.STRING(50)
            },
            vg_vendor_status:{
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
            tableName:'vendor_group_dtl_tbl'
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
            attributes: {
                include: [
                    [
                        Sequelize.literal(`(
                            Select vendor_description
                            from vendor_tbl
                            where vendor_tbl.vendor_id = vendor_group_dtl_tbl.vg_vendor_id
                        )`),
                        'vg_vendor_desc'
                    ],
                ]
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

    static associate (models) {
        this.vendor_group = this.hasOne(models.vendor_group_tbl,{
            sourceKey:'vg_code',
            foreignKey:'vg_code'
        })

        this.vendor = this.hasOne(models.vendor_tbl,{
            sourceKey:'vg_vendor_id',
            foreignKey:'vendor_id',
            as:'vendor_hdr'
        })
    }
}

module.exports = vendor_group_dtl_tbl;