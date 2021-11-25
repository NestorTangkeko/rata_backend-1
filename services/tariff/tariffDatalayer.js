const models = require('../../models');
const {sequelize,Sequelize} = models;
const moment = require('moment');

const createTariffTypeHeader = async({
    data,
    options
}) => {
    try{
        return await models.tariff_type_tbl.create({
            ...data
        },{
            ...options
        })
    }
    catch(e){
        throw e
    }
}

const createTariffCondition = async({
    data,
    options
}) => {
    try{
        return await models.tariff_type_cond.bulkCreate(data,{
            ...options
        })
    }
    catch(e){
        throw e
    }
}

const createTariffType = async({
    header,
    conditions
}) => {
    try{
        return await sequelize.transaction(async t => {
            await createTariffTypeHeader({
                data:header,
                options:{
                    transaction: t
                }
            })

            await createTariffCondition({
                data:conditions,
                options:{
                    transaction: t
                }
            })
        })
    }
    catch(e){
        throw e 
    }
}

const getAllTariffTypes = async({filters}) => {
    try{
        return await models.tariff_type_tbl.findAll({
            where:{
                ...filters
            }
        })
    }   
    catch(e){
        throw e
    }
}

const getTariff = async({filter,options}) => {
    try{
        return await models.tariff_sell_hdr_tbl.findOne({
            where:{
                ...filter
            }
        })
        .then(result => result.toJSON())
    }
    catch(e){

    }
}

const updateTariff = async({filter,data,option}) => {
    try{
        return await models.tariff_sell_hdr_tbl.update(
            {
                ...data
            },
            {
                where:{
                    ...filter
                }
            }
        )
    }
    catch(e){
        throw e
    }
}

const createTariff = async({data,options}) => {
    try{
        const tariff = await getTariff({
            filter:{
                tariff_id: data.tariff_id
            }
        })

        if(!tariff){
            const {modified_by,approved_by,...newData} = data
            await models.tariff_sell_hdr_tbl.create(newData,
            {
                ...options
            })  
        }
        else{
            const {tariff_id,created_by,approved_by,...filteredData} = data
            
            let newData;

            if(data.tariff_status === 'APPROVED'){
                newData = {
                    ...filteredData,
                    approved_by:data.approved_by,
                    approved_date:moment().format("YYYY-MM-DD HH:mm:ss").toString()
                }
            }
            else{
                newData={
                    ...filteredData
                }
            }

            await updateTariff({
                filter:{
                    tariff_id: data.tariff_id
                },
                data:{
                    ...newData
                }
            })
        }
    }
    catch(e){
        throw e
    }
}

const bulkCreateTariff = async({data,options}) => {
    try{
        return await models.tariff_sell_hdr_tbl.bulkCreate(data,{
            ...options
        })
    }
    catch(e){
        throw e
    }
}


const getPaginatedTariff = async({
    filters,
    page,
    totalPage
})=>{
    try{

        const {count,rows} = await models.tariff_sell_hdr_tbl.findAndCountAll({
            where:{
                ...filters
            },
            offset:parseInt(page) * parseInt(totalPage),
            limit:parseInt(totalPage)
        })
        .then(result => {
            let {count,rows} = JSON.parse(JSON.stringify(result))
            return {
                count,
                rows
            }
        })

        return {
            count,
            rows    
        }

    }
    catch(e){
        throw e
    }

}

const getAllTariff = async({filters}) => {
    try{
        return await models.tariff_sell_hdr_tbl.findAll({
            where:{
                ...filters
            }
        })
    }
    catch(e){
        throw e
    }
}




module.exports = {
    createTariffCondition,
    createTariffType,
    createTariffTypeHeader,
    createTariff,
    bulkCreateTariff,
    getAllTariffTypes,
    getPaginatedTariff,
    updateTariff,
    getTariff,
    getAllTariff
}