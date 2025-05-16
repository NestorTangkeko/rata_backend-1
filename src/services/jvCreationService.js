const moment = require('moment');
const path = require('path');
const axios = require('axios').default;
const asciiService = require('../services/asciiService');
const excelJs   = require('exceljs');
const models = require('../models/rata');
const {v4:uuidv4} = require('uuid');
const useGlobalFilter = require('../helpers/filters');
const {sequelize, Sequelize} = models;
const jvHelper = require('../../helper/jvHelper');
const _ = require('lodash');
const fs = require('fs');
const {Op}                  = Sequelize;

const getJVDraftBill = async (query) => {
    const {
        page,
        totalPage,
        search,
        ...filters
    } = query;

    const where = {};

    Object.keys(filters).map(key => {
        if(key === 'CR_DATE'){
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
        model: models.draft_bill_hdr_tbl.getAttributes(),
        filters:{
            search
        }
    })

    const { count, rows } = await models.draft_bill_details_tbl.findAndCountAll({
        include: [
            {
                model: models.draft_bill_hdr_tbl,
                required: true,
                where: {
                    location: 'Manila',
                    service_type: 'DF FCL',
                    contract_type: 'BUY',
                    vendor: '99999',
                    status: 'DRAFT_BILL',
                    ...where,         // your filters from bill_header_tbl
                    ...globalFilter   // also filters from bill_header_tbl
                },
                attributes: [
                    'draft_bill_no', 
                    'draft_bill_date',
                    'trip_no',
                    'location',
                    'vehicle_type',
                    'vendor',
                    'customer',
                    'service_type',
                    'stc_from',
                    'stc_to',
                    'tariff_id',
                    'total_charges'
                ],
                include: [
                    { 
                        model: models.vendor_tbl,
                        attributes: ['vendor_description'],
                    },
                    { 
                        model: models.principal_tbl,
                        attributes: ['principal_name'],
                    },
                    { 
                        model: models.service_type_tbl,
                        attributes: ['service_type_desc'],
                    },
                ]
            },
            {
                model: models.helios_invoices_hdr_tbl, 
                required: false,
                attributes: ['vehicle_id'],
                as: 'invoice'
            },
            {
                model: models.jv_detail_tbl,
                required: false,
                // where: {
                //     draft_bill_no: null
                // },
                as: 'jv_detail',
            }
        ],
        attributes: ['draft_bill_no', 'invoice_no', 'createdAt'],
        order: [['createdAt', 'DESC']], 
        // where: {
        //     '$jv_detail.draft_bill_no$': { [Op.is]: null }
        // },
        offset: parseInt(page) * parseInt(totalPage),
        limit: parseInt(totalPage)
    });
      

    return {
        count,
        rows,
        pageCount: Math.ceil(count/totalPage)
    }
}

const getJVDraftBillV2 = async (query) => {
    const {
        page,
        totalPage,
        search,
        ...filters
    } = query;

    let where = ``;

    Object.keys(filters).map(key => {
        if(key === 'jvc_db_date'){
            const dates = filters.jvc_db_date.split(',')
            const from = moment(dates[0]).isValid() ? dates[0] : null;
            const to = moment(dates[1]).isValid() ? dates[1] : null;
        
            if (from && to) {
                return where+= `AND a.draft_bill_date BETWEEN '${from.toString()}' AND '${to.toString()}' \n`;
            }
        }
        if(key === 'jvc_customer') {
            return where+=`AND c.principal_name = '${filters.jvc_customer}' \n`
        }
    })

    if (search) {
        where += `
            AND (
                a.draft_bill_no         LIKE '%${search}%' OR
                a.draft_bill_date       LIKE '%${search}%' OR
                a.trip_no               LIKE '%${search}%' OR
                b.invoice_no            LIKE '%${search}%' OR
                c.principal_name        LIKE '%${search}%' OR
                d.service_type_desc     LIKE '%${search}%' OR
                a.location              LIKE '%${search}%' OR
                e.vendor_description    LIKE '%${search}%' OR
                a.vehicle_type          LIKE '%${search}%' OR
                f.vehicle_id            LIKE '%${search}%' OR
                a.stc_from              LIKE '%${search}%' OR
                a.stc_to                LIKE '%${search}%' OR
                a.tariff_id             LIKE '%${search}%' OR
                a.total_charges         LIKE '%${search}%'
            )
        `
    }

    const count2 = await sequelize.query(
        `SELECT
            count(*) AS count
        FROM draft_bill_hdr_tbl a

        INNER JOIN draft_bill_detail_tbl b
        ON b.draft_bill_no = a.draft_bill_no

        LEFT JOIN principal_tbl c
        ON c.principal_code = a.customer

        LEFT JOIN service_type_tbl d 
        ON d.service_type_code = a.service_type

        LEFT JOIN vendor_tbl e
        ON e.vendor_id = a.vendor

        LEFT JOIN helios_invoices_hdr_tbl f
        ON f.tms_reference_no = b.fk_tms_reference_no

        LEFT JOIN jv_detail_tbl g
        ON g.draft_bill_no = b.draft_bill_no
        AND g.ref_code = b.tms_reference_no

        WHERE 1=1
        AND a.location = 'Manila'
        AND a.service_type = 'DF FCL'
        AND a.contract_type = 'BUY'
        AND a.vendor = '99999'
        AND a.status = 'DRAFT_BILL'
        AND g.jv_ref_no IS NULL
        ${where}
        ;`, {
            type: Sequelize.QueryTypes.SELECT,
        }).then((result) => {
            return result.length > 0 ? result[0].count : null;
        });;

    const rows2 = await sequelize.query(`
        SELECT
            a.draft_bill_no         AS jvc_db_no,
            a.draft_bill_date       AS jvc_db_date,
            a.trip_no               AS jvc_trip_no,
            b.invoice_no            AS jvc_invoice_no,
            c.principal_name        AS jvc_customer,
            d.service_type_desc     AS jvc_service_type,
            a.location              AS jvc_location,
            e.vendor_description    AS jvc_vendor,
            a.vehicle_type          AS jvc_vehicle_type,
            f.vehicle_id            AS jvc_vehicle_id,
            a.stc_from              AS jvc_stc_from,
            a.stc_to                AS jvc_stc_to,
            a.tariff_id             AS jvc_tariff_id,
            a.total_charges         AS jvc_total_charges
        FROM draft_bill_hdr_tbl a

        INNER JOIN draft_bill_detail_tbl b
        ON b.draft_bill_no = a.draft_bill_no

        LEFT JOIN principal_tbl c
        ON c.principal_code = a.customer

        LEFT JOIN service_type_tbl d 
        ON d.service_type_code = a.service_type

        LEFT JOIN vendor_tbl e
        ON e.vendor_id = a.vendor

        LEFT JOIN helios_invoices_hdr_tbl f
        ON f.tms_reference_no = b.fk_tms_reference_no

        LEFT JOIN jv_detail_tbl g
        ON g.draft_bill_no = b.draft_bill_no
        AND g.ref_code = b.tms_reference_no

        WHERE 1=1
        AND a.location = 'Manila'
        AND a.service_type = 'DF FCL'
        AND a.contract_type = 'BUY'
        AND a.vendor = '99999'
        AND a.status = 'DRAFT_BILL'
        AND g.jv_ref_no IS NULL

        ${where}

        ORDER BY a.draft_bill_no DESC

        LIMIT ${parseInt(page) * parseInt(totalPage)}, ${parseInt(totalPage)} 
        ;`, {
            type: Sequelize.QueryTypes.SELECT,
        });
      

    return {
        count: count2,
        rows: rows2,
        pageCount: Math.ceil(count2/totalPage)
    }
}

const getJVDraftBillHeader = async(filter) => {
    return await models.draft_bill_hdr_tbl.findOne({
        where:{
            ...filter
        }
    })
}

const generateJV = async(
    ids,
    processor_id
) => {
    const transaction = await sequelize.transaction();

    try {
        const detail_data = await getJVCreationDetails(ids);
        if(detail_data.length === 0) throw new Error('No data found');
        
        let jvc_series = await getLastSeriesNumber({prefix: 'JVC'});
        if (jvc_series >= 999) throw new Error(`JV Creation exceeded daily ammount: 999.`);

        const jv_ref = jvHelper.generateSeries("JVC", jvc_series+1);

        const jv_filename = `${jv_ref}.xlsx`;

        const header_data = await getJVCreationHeader(detail_data, jv_ref);

        const processor_data = await getProcessorEmail(processor_id);

        const jvCreationWorkbook = await jvHelper.generateJVCreationExcel(header_data, detail_data, processor_data);
        const jv_header_insert = await jvHelper.formatJVCHeader(header_data, processor_id);

        const jv_detail_insert = await jvHelper.formatJVCDetail(jv_ref, detail_data, processor_id);
        
        await models.jv_header_tbl.create(
            jv_header_insert, 
            {
                transaction: transaction
            }
        )

        await insertJVData({
            data: jv_detail_insert,
            targetTableName: "jv_detail_tbl",
            transaction: transaction
        });
        
        await setSeriesNumber("JVC", jvc_series+1, transaction);

        
        let filepath = path.join(__dirname, '../../assets/reports/jv', jv_filename);
        
        await jvCreationWorkbook.xlsx.writeFile(filepath);
        const jvcContents = fs.readFileSync(filepath, { encoding: 'base64' });
        
        await transaction.commit();

        return {
            workbook: jvCreationWorkbook,
            filename: jv_filename
        }

        

    } catch (e) {
        await transaction?.rollback();
        console.error(e);
		throw e;
    }
}

const getLastSeriesNumber = async({
    prefix
}) => {
    try {
        const [year, month, day] = new Date().toISOString().split('T')[0].split('-');
        const dateKey = `${year.slice(2)}${month}${day}`;

        // For daily-reset series like NR/NE
        const whereClause = ["JVC", "JVR"].includes(prefix) 
            ? { prefix, date_key: dateKey }
            : { prefix, date_key: { [Op.is]: null } }; // For continuous series like VBR/VTR

        const record = await models.jv_ref_series_tracker.findOne({
            where: whereClause,
            attributes: ["last_number"],
        });

        return record ? record.last_number : 0; // Return last_number or default to 0
    }
    catch(e) {
        throw e
    }
}

const setSeriesNumber = async(
    prefix, 
    newLastNumber,
    transaction
) => {
    if (!Number.isInteger(newLastNumber) || newLastNumber < 0) {
        throw new Error("Invalid number. It must be a non-negative integer.");
    }

    const [year, month, day] = new Date().toISOString().split('T')[0].split('-');
    const dateKey = `${year.slice(2)}${month}${day}`;

    // Determine if the series resets daily or is continuous
    const whereClause = ["JVC", "JVR"].includes(prefix) 
        ? { prefix, date_key: dateKey }
        : { prefix, date_key: { [Op.is]: null } }; // Continuous series like VBR/VTR

    const defaults = ["JVC", "JVR"].includes(prefix)
        ? { last_number: newLastNumber, date_key: dateKey }
        : { last_number: newLastNumber, date_key: null };
    
    // Find or create the tracking record
    const [record, created] = await models.jv_ref_series_tracker.findOrCreate({
        where: whereClause,
        defaults,
        transaction,
        logging: false,
        lock: transaction.LOCK.UPDATE
    });

    // Update the last_number if the new value is greater
    if (record.last_number < newLastNumber) {
        await record.update({ last_number: newLastNumber }, { transaction });
        return `Updated ${prefix} series to ${newLastNumber}`;
    } else {
        return `No update needed. ${prefix} series is already at ${record.last_number}`;
    }
}

const getJVCreationDetails = async(
    ids
) => {
    try {
		return await sequelize.query(
            `SELECT 
                a.draft_bill_no,
                a.tms_reference_no,
                a.ship_from,
                a.ship_to,
                b.location,
                b.customer,
                b.service_type,
                b.vehicle_type,
                c.vehicle_id,
                b.vendor,
                b.total_charges
            FROM draft_bill_detail_tbl a
            LEFT JOIN draft_bill_hdr_tbl b
            ON b.draft_bill_no = a.draft_bill_no

            LEFT JOIN helios_invoices_hdr_tbl c
            ON c.tms_reference_no = a.fk_tms_reference_no

            WHERE a.draft_bill_no IN (${ids.map((x) => "'" + x + "'").join(",")});`,
            {
                type: Sequelize.QueryTypes.SELECT,
            }).then((result) => {
                // Parse result and convert total_charges
                return result.map((row) => ({
                    ...row,
                    total_charges: row.total_charges !== null ? parseFloat(row.total_charges) : null,
                }));
			});
	} catch (e) {
		console.log(e);
		throw e;
	}
}

const getJVCreationHeader = async(
    detail_data,
    jv_ref
) => {
    try {

        const total_amount = _.sumBy(detail_data, item => parseInt(item.total_charges, 10));
        const cost_center = await sequelize.query(`
            SELECT ascii_service_type 
            FROM service_type_tbl
            WHERE service_type_code = '${_.chain(detail_data)
                .map('service_type')
                .uniq()
                .value()}'
            LIMIT 1;
        `,
        {
            type: sequelize.QueryTypes.SELECT
        })
        .then((result) => {
            return result.length > 0 ? result[0].ascii_service_type : null;
        });

        const location = await sequelize.query(`
            SELECT ascii_loc_code 
            FROM location_tbl
            WHERE loc_code = '${_.chain(detail_data)
                .map('location')
                .uniq()
                .value()}'
            LIMIT 1;
        `,
        {
            type: sequelize.QueryTypes.SELECT
        })
        .then((result) => {
            return result.length > 0 ? result[0].ascii_loc_code : null;
        });

        return {
            jv_ref_no: jv_ref,
            total_amount,
            cost_center,
            location,
            service_type: cost_center,
            department_code: cost_center
        }
    } catch (e) {
        console.error(e);
        throw e;
    }
}

const getProcessorEmail = async(
    processor_id
) => {
    try {
        const processor_data = await sequelize.query(`
            SELECT email FROM user_tbl 
            WHERE id = '${processor_id}'
            LIMIT 1;
        `,
        {
            type: sequelize.QueryTypes.SELECT
        })
        .then((result) => {
            return result.length > 0 ? result[0]?.email ?? 'RATA': 'RATA';
        });

        return processor_data;


    } catch (e) {
        console.error(e);
        throw e;
    }
}

const insertJVData = async({
    data,
    targetTableName,
    transaction
}) => {
    try {
        if(typeof targetTableName !== 'string' || !targetTableName) { 
            throw new Error('Target table not defined.'); 
        }
        return await models[targetTableName].bulkCreate(
            data, 
            {
                validate: false, 
                logging: true, 
                transaction : transaction
            }
        );
    }
    catch(e) {
        throw e
    }
}


module.exports = {
    getJVDraftBill,
    getJVDraftBillV2,
    getJVDraftBillHeader,
    generateJV,
    getJVCreationDetails,
}