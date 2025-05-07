const models = require('../models/rata');
const path = require('path');
const mime = require('mime');
const fs = require('fs');

const jvReversalService = require('../services/jvReversalService');

const Sequelize = require('sequelize');

exports.getPaginatedJVReversal = async(req,res,next) => {
    try{
        const data = await jvReversalService.getJVReversal(req.query);

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

exports.reverseJV = async(req, res, next) => {
    try{
        const jv_data = req.body.data;
        const processor_id = req.processor?.id;
        
        const data = await jvReversalService.reverseJV(jv_data, processor_id);
        const { workbook, filename } = data;

        const buffer = await workbook.xlsx.writeBuffer();

        res.set('Content-disposition',`${filename}`);
        res.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    
        res.send(buffer);

    }
    catch(e){
        console.log(e);
        next(e);
    }
}

exports.exportJVC = async(req, res, next) => {
    try {
        const {jv_ref} = req.params;

        const processor_id = req.processor?.id;

        const data = await jvReversalService.exportJVC(jv_ref, processor_id);
        const { workbook, filename } = data;

        const buffer = await workbook.xlsx.writeBuffer();

        res.set('Content-disposition',`${filename}`);
        res.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    
        res.send(buffer);



    } catch (e) {
        console.log(e);
        next(e);
    }
}


exports.exportJVR = async(req, res, next) => {
    try {
        const {jv_ref} = req.params;
        const processor_id = req.processor?.id;

        const data = await jvReversalService.exportJVR(jv_ref, processor_id);
        const { workbook, filename } = data;

        const buffer = await workbook.xlsx.writeBuffer();

        res.set('Content-disposition',`${filename}`);
        res.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    
        res.send(buffer);



    } catch (e) {
        console.log(e);
        next(e);
    }
}