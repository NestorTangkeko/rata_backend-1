const xlsx = require('exceljs')
const moment = require('moment');
const axios = require('axios').default;
const asciiService = require('../services/asciiService');
const models = require('../models/rata');
const {v4:uuidv4} = require('uuid');
const useGlobalFilter = require('../helpers/filters');
const Sequelize = require('sequelize');

const api = axios.create({
    baseURL:process.env.ASCII_API,
    headers:{
        [`Accept`]:'application/json'
    }
})

exports.login = async() => {
    try{

        const username = process.env.ASCII_USER_NAME
        const password = process.env.ASCII_PASSWORD
        const apiKey = process.env.ASCII_API_KEY

        //delete ascii user_session
        //await asciiService.deleteAPISession(username);
        
        return await api.post('/login',{
            username,
            password,
            api_key:apiKey
        })
        .then(result => {
            console.log(result.data)
            return result.data.access_token
        })

       
    } 
    catch(e){
       throw e
    }
}

const readSO = async(filename) => {
    const workbook = new xlsx.Workbook();
    await workbook.xlsx.readFile(filename);

    const headerWs = workbook.getWorksheet('header');
    const detailsWs = workbook.getWorksheet('details');

    let header = []
    let details = []
    
    const columnHeader = [
        'COMPANY_CODE',	
        'SO_CODE',	
        'ITEM_TYPE',	
        'SO_DATE',	
        'CUSTOMER_CODE',	
        'PARTICULAR',
        'REF_EUPO',	
        'REF_CROSS',	
        'SO_AMT'

    ];
    const columnDetails = [
        'COMPANY_CODE',	
        'SO_CODE',
        'ITEM_CODE',	
        'LINE_NO',	
        'LOCATION_CODE',	
        'UM_CODE',	
        'QUANTITY',	
        'UNIT_PRICE',	
        'EXTENDED_AMT'
    ]

    
    headerWs.eachRow((row,rowNumber) => {
        let data = {}
        row.values.map((item,index) => {
            if(item instanceof Date){
                data[columnHeader[index-1]] = moment(item).format('YYYY-MM-DD')
            }
            else if(item instanceof Object) {
                data[columnHeader[index-1]] = item.result
            }
            else {
                data[columnHeader[index-1]] = item    
            }
        })

        header.push(data)
    })

    detailsWs.eachRow((row,rowNumber) => {
        let data = {}
        row.values.map((item,index) => {
            if(item instanceof Date){
                data[columnDetails[index-1]] = moment(item).format('YYYY-MM-DD')
            }
            else if(item instanceof Object) {
                data[columnDetails[index-1]] = item.result
            }
            else {
                data[columnDetails[index-1]] = item    
            }
        })

        details.push(data)
    })

    header = header.slice(2)
    details = details.slice(2)

    return header.map(item => {
        const id = uuidv4();
        const SALES_ORDER_DETAIL = details.filter(a => a.SO_CODE === item.SO_CODE).map(a => {
            return {
                ...a,
                COMPANY_CODE: '00001',
                fk_header_id: id
            }
        })
        
        return {
            ...item,
            id,
            COMPANY_CODE:'00001',
            ITEM_TYPE:'S',
            SALES_ORDER_DETAIL
        }
    })
}


exports.uploadSO = async({
    file,
    token
}) => {
    let details = [];
    const so_data = await readSO(file.path);
  
    const result = await api.post('/get/sales-order',so_data,{
        headers:{
            ['Content-Type']: 'application/json',
            ['Authorization']: `Bearer ${token}`
        }
    })
    .then(res => {    
        return {
            errors:res.data?.ERROR || [],
            success:res.data?.SUMMARY || []
        }
    })
    .catch(e => {
        throw e
    })

    const errorLogs = await asciiService.generateErrors(result.errors)
        
    const data = so_data.map(item => {
        const hasError = errorLogs.find(a => a.ref_code === item.SO_CODE)

        details = details.concat(item.SALES_ORDER_DETAIL)
        return {
            ...item,
            STATUS: hasError ? 'SO_FAILED' : 'SO_CREATED'
        }
    })

    return {
        data,
        details,
        ascii_success: result.success,
        ascii_errors: result.errors,
        errors: errorLogs.map(item => {
            const header = data.find(a => a.SO_CODE ===item.ref_code)
            return {
                ...item,
                fk_header_id: header.id
            }
        })
    }
}

exports.bulkCreateHeader = async(data = [], stx = null) => {
    return await models.so_upload_header_tbl.bulkCreate(data, {
        transaction: stx
    })
}

exports.bulkCreateDetails = async(data = [], stx= null) => {
    return await models.so_upload_details_tbl.bulkCreate(data, {
        transaction: stx
    })
}

exports.bulkCreateErrorLogs = async(data= [], stx = null) => {
    return await models.so_upload_errors_tbl.bulkCreate(data,{
        transaction: stx
    })
}

exports.getPaginatedSO = async(query) => {
    try{
        const {
                page,
                totalPage,
                search,
                ...filters
            } = query;
        
            const where = {};
        
            Object.keys(filters).map(key => {
                
                if(key === 'SO_DATE'){
                    const dates = filters.CR_DATE.split(',')
                    const from = moment(dates[0]).isValid() ? dates[0] : null;
                    const to = moment(dates[1]).isValid() ? dates[1] : null;
                
                    if (from && to) {
                        return where.CR_DATE = {
                            [Sequelize.Op.between]: [from,to]
                        }
                    }
                }
                else return where[key] = filters[key]
            })
        
            const globalFilter = useGlobalFilter.defaultFilter({
                model: models.so_upload_header_tbl.getAttributes(),
                filters:{
                    search
                }
            })
        
            const {count,rows} = await models.so_upload_header_tbl.findAndCountAll({
                include:[
                    {
                        model: models.user_tbl,
                        required:false
                    }
                ],
                order: [['createdAt','DESC']],
                offset: parseInt(page) * parseInt(totalPage),
                limit: parseInt(totalPage),
                where:{
                    ...where,
                    ...globalFilter   
                }
            })
            .then(result => JSON.parse(JSON.stringify(result)))
        
            return {
                count,
                rows: rows.map(item => {
                    const {user_tbl,...newItem} = item;
                    return {
                        ...newItem,
                        uploaded_by: user_tbl.first_name+' '+user_tbl.last_name
                    }
                }),
                pageCount: Math.ceil(count/totalPage)
            }
    }
    catch(e){
        next(e)
    }
}

exports.getSoHeader = async(filter) => {
    return await models.so_upload_header_tbl.findOne({
        where:{
            ...filter
        }
    })
}

exports.getPaginatedDetails = async(query) => {
    const {
        page,
        totalPage,
        search,
        ...filters
    } = query;

    const globalFilter = useGlobalFilter.defaultFilter({
        model: models.so_upload_details_tbl.getAttributes(),
        filters:{
            search
        }
    })

    const {count,rows} = await models.so_upload_details_tbl.findAndCountAll({
        where:{
            ...filters,
            ...globalFilter
        },
        order: [['createdAt','DESC']],
        offset: parseInt(page) * parseInt(totalPage),
        limit: parseInt(totalPage),
    })

    return {
        count,
        rows,
        pageCount: Math.ceil(count/totalPage)
    }

}


exports.getPaginatedError = async(query) => {
    const {
        page,
        totalPage,
        search,
        ...filters
    } = query;

    const globalFilter = useGlobalFilter.defaultFilter({
        model: models.so_upload_errors_tbl.getAttributes(),
        filters:{
            search
        }
    })

    const {count,rows} = await models.so_upload_errors_tbl.findAndCountAll({
        include:[
            {
                model: models.user_tbl,
                required:false
            }
        ],
        where:{
            ...filters,
            ...globalFilter
        },
        order: [['createdAt','DESC']],
        offset: parseInt(page) * parseInt(totalPage),
        limit: parseInt(totalPage),
    })
    .then(result => JSON.parse(JSON.stringify(result)))
    
    return {
        count,
        rows: rows.map(item => {
            const {user_tbl,...newItem} = item;
            return {
                ...newItem,
                uploaded_by: user_tbl.first_name+' '+user_tbl.last_name
            }
        }),
        pageCount: Math.ceil(count/totalPage)
    }
}

exports.getAllSOHeader = async(filter) => {
    return await models.so_upload_header_tbl.findAll({
        where:{
            ...filter
        }
    })
    .then(res => JSON.parse(JSON.stringify(res)))
}

exports.getAllSODetails = async(filter) => {
    return await models.so_upload_details_tbl.findAll({
        where:{
            ...filter
        }
    })
    .then(res => JSON.parse(JSON.stringify(res)))
}

exports.getAllSOErrors = async(filter) => {
    return await models.so_upload_errors_tbl.findAll({
        where:{
            ...filter
        }
    })
    .then(res => JSON.parse(JSON.stringify(res)))
}