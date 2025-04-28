const models = require('../models/rata');
const path = require('path');
const mime = require('mime');
const fs = require('fs');

const jvCreationService = require('../services/jvCreationService');

const Sequelize = require('sequelize');

exports.getPaginatedJVDraftBill = async(req,res,next) => {
    try{
        const data = await jvCreationService.getJVDraftBillV2(req.query);

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

exports.getJVDraftBill = async(req,res,next) => {
    try{
        const {id} = req.params;

        const data = await jvCreationService.getJVDraftBillHeader({
            id
        })

        res.status(200).json(data)
    }
    catch(e){
        next(e)
    }
}

exports.generateJV = async(req, res, next) => {
    try{
        const ids = req.body.ids;
        const processor_id = req.processor?.id;
        
        const data = await jvCreationService.generateJV(ids, processor_id);
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