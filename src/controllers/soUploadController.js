const models = require('../models/rata');
const path = require('path');
const mime = require('mime');
const fs = require('fs');
const asciiService = require('../services/asciiService');
const soUploadService = require('../services/soUploadService');
const { generateExcel } = require('../services/dataExportService')
const { Sequelize } = models;

exports.template = async(req,res,next) => {
    try{

        const file = path.join(path.resolve(__dirname, '../../'),'/assets/templates/so_upload_template.xlsx')
        const filename = path.basename(file);
        const mimeType = mime.lookup(file);

        res.set('Content-disposition', filename);
        res.set('Content-type', mimeType);

        const filestream = fs.createReadStream(file);
        filestream.pipe(res);
    }
    catch(e){
        next(e)
    }
}

exports.uploadSO = async(req,res,next) => {
    const stx = await models.sequelize.transaction();
    try{
        const user =  req.processor.id;
        const file = req.file;

        const token = await soUploadService.login();

        const {
            data,
            details,
            errors,
            ascii_errors,
            ascii_success
        } = await soUploadService.uploadSO({
            file,
            token
        });

        await soUploadService.bulkCreateHeader(data.map(({SALES_ORDER_DETAIL,...item}) => {
            return {
                ...item,
                created_by: user
            }
        }), stx);

        await soUploadService.bulkCreateDetails(details.map(item => {
            return {
                ...item,
                created_by: user
            }
        }), stx)

        await soUploadService.bulkCreateErrorLogs(errors.map(item => {
            return {
                ...item,
                created_by: user
            }
        }), stx)

        console.log({
            ascii_errors,
            ascii_success
        })
        
        const xlsx = await asciiService.generateResult({
            success: ascii_success,
            errors: ascii_errors,
            data
        })

        await stx.commit();

        res.set('Content-disposition',`so_upload_result.xlsx`);
        res.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    
        res.send(xlsx)
    }
    catch(e){
        await stx.rollback();
        next(e)
    }
}

exports.getSo = async(req,res,next) => {
    try{
        const {id} = req.params;
        
        const data = await soUploadService.getSoHeader({
            id
        })

        res.status(200).json(data)
    }
    catch(e){
        next(e)
    }
}

exports.getPaginated = async(req,res,next) => {
    try{
        const data = await soUploadService.getPaginatedSO(req.query);
    
        res.status(200).json({
            data:      data.rows,
            rows:      data.count,
            pageCount: data.pageCount
        })
    }
    catch(e){
        next(e)
    }
}

exports.getPaginatedDetails = async(req,res,next)=>{
    try{
        const data = await soUploadService.getPaginatedDetails(req.query);
        
        res.status(200).json({
            data:      data.rows,
            rows:      data.count,
            pageCount: data.pageCount
        })
    }
    catch(e){
        next(e)
    }
}

exports.getPaginatedErrors = async(req,res,next) => {
    try{
        const data = await soUploadService.getPaginatedError(req.query);

        res.status(200).json({
            data:      data.rows,
            rows:      data.count,
            pageCount: data.pageCount
        })
    }
    catch(e){
        next(e)
    }
}

exports.exportSO = async(req,res,next) => {
    try{
        const {
            type,
            from,
            to
        } = req.query;

      
        const getHeader = await soUploadService.getAllSOHeader({
            SO_DATE: {
                [Sequelize.Op.between]: [from,to]
            },
            STATUS: type
        })

        const getDetails = await soUploadService.getAllSODetails({
            fk_header_id: getHeader.map(item => item.id)
        })

        const getErrors = await soUploadService.getAllSOErrors({
            fk_header_id: getHeader.map(item => item.id)
        })

        const xlsx = await generateExcel({
            header: getHeader,
            details: getDetails.map(({id,...item}) => item),
            errors: getErrors.map(({id,...item}) => item)
        })

        res.set('Content-disposition',`sales_order.xlsx`);
        res.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)

    }
    catch(e){
        console.log(e)
        next(e)
        
    }
}