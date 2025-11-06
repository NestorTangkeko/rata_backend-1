const {Sequelize,DataTypes,Model} = require('sequelize');


class  helios_invoices_hdr_tbl extends Model {
    static init (sequelize) {
        return super.init({
            tms_reference_no:       {
                primaryKey:true,
                type:DataTypes.STRING
            },
            trip_no:           {
                type:DataTypes.STRING
            },
            trip_date:              {
                type: DataTypes.DATEONLY
            },
            location:               {
                type:DataTypes.STRING
            },
            trip_status:            {
                type:DataTypes.STRING
            },
            trucker_id:             {
                type:DataTypes.STRING
            },
            vehicle_type:           {
                type:DataTypes.STRING
            },
            vehicle_id:             {
                type:DataTypes.STRING
            },
            planned_trucker:        {
                type:DataTypes.STRING
            },
            planned_vehicle_type:   {
                type:DataTypes.STRING
            },
            planned_vehicle_id:     {
                type:DataTypes.STRING
            },
            service_type:           {
                type:DataTypes.STRING
            },
            sub_service_type:       {
                type:DataTypes.STRING
            },
            invoice_no:             {
                type:DataTypes.STRING
            },
            rdd:                    {
                type: DataTypes.DATEONLY
            },
            dr_no:                  {
                type:DataTypes.STRING
            },
            shipment_manifest:      {
                type:DataTypes.STRING
            },
            principal_code:         {
                type:DataTypes.STRING
            },
            stc_from:               {
                type:DataTypes.STRING
            },
            stc_to:                 {
                type:DataTypes.STRING
            },
            br_status:              {
                type:DataTypes.STRING
            },
            delivery_status:        {
                type:DataTypes.STRING
            },
            rud_status:             {
                type:DataTypes.STRING
            },
            reason_code:            {
                type:DataTypes.STRING
            },
            redel_remarks:          {
                type:DataTypes.STRING
            },
            is_billable:            {
                type: DataTypes.TINYINT
            },      
            is_billable_buy:        {
                type: DataTypes.TINYINT
            },
            is_processed_sell:      {
                type: DataTypes.TINYINT
            },
            is_processed_buy:       {
                type: DataTypes.TINYINT
            }, 
            cleared_date:           {
                type: DataTypes.DATE
            },  
            trucker_cleared_date:{
                type: DataTypes.DATE
            },
            job_id:{
                type:DataTypes.STRING
            },
            createdAt:Sequelize.DATE,
            updatedAt:Sequelize.DATE,
        },
        {
            freezeTableName:true,
            sequelize,
            tableName:'helios_invoices_hdr_tbl'
        })
    }

    static async paginated({
        filters,
        options,
        order,
        page,
        totalPage
    }) {
        const {search,...newFilters} = filters

        return await this.findAndCountAll({
            where:{
                ...newFilters
            },
            ...options,
            offset: parseInt(page) * parseInt(totalPage),
            limit:parseInt(totalPage),
            order
        })
        .then(result => JSON.parse(JSON.stringify(result)))
    }

    static async getData ({where,options}) {
        return await this.findAll({
            ...options,
            where:{
                ...where
            }
        }).then(result => JSON.parse(JSON.stringify(result)))
    }

    static async bulkCreateData ({data,options}) {
        return await this.bulkCreate(data,
        {
            ...options
        })
    }

    static async updateData ({data,options,where}) {
        return await this.update(data,{
            where:{
                ...where
            },
            ...options
        })
    }
    
    static associate(models) {
        this.details = this.hasMany(models.helios_invoices_dtl_tbl,{
            foreignKey:'br_no',
            sourceKey:'tms_reference_no',  
        }) 

        this.ship_point_from = this.hasOne(models.ship_point_tbl,{
            foreignKey:'stc_code',
            sourceKey:'stc_from',
            as:'ship_point_from'
        })
        this.ship_point_to = this.hasOne(models.ship_point_tbl,{
            foreignKey:'stc_code',
            sourceKey:'stc_to',
            as:'ship_point_to'
        })

        this.vendor = this.hasOne(models.vendor_tbl,{
            foreignKey:'vendor_id',
            sourceKey:'trucker_id'
        })

        this.vendor_group = this.hasOne(models.vendor_group_dtl_tbl,{
            foreignKey:'vg_vendor_id',
            sourceKey:'trucker_id'
        })

        this.service_type = this.hasOne(models.service_type_tbl,{
            foreignKey:'service_type_code',
            sourceKey:'service_type'
        })
    
        this.principal = this.hasOne(models.principal_tbl,{
            foreignKey:'principal_code',
            sourceKey:'principal_code'
        })
    }

}

module.exports = helios_invoices_hdr_tbl;