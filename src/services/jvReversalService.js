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

const getJVReversal = async (query) => {
    const {
        page,
        totalPage,
        search,
        ...filters
    } = query;

    let where = ``;

    Object.keys(filters).map(key => {
        if(key === 'jv_status') {
            return where+=`AND g.status = '${filters.jv_status}' \n`
        }   
        if(key === 'jv_actual_vendor') {
            return where+=`AND h.ascii_vendor_code = '${filters.jv_actual_vendor}' \n`
        }
        if(key === 'jv_create_ref_no') {
            return where+=`AND (g.jv_ref_no = '${filters.jv_create_ref_no}' \n
            OR g.jv_create_ref_No = '${filters.jv_create_ref_no}') \n`
        }
        if(key === 'jv_actual_cr') {
            console.log("filters.jv_actual_cr: ", filters.jv_actual_cr)
            if (filters.jv_actual_cr === true) {
                return where+=`AND h.draft_bill_no IS NOT NULL \n` ;
            }
            else {
                return where+=`AND h.draft_bill_no IS NULL \n`;
            }
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
                b.ship_from             LIKE '%${search}%' OR
                b.ship_to               LIKE '%${search}%' OR
                a.tariff_id             LIKE '%${search}%' OR
                a.total_charges         LIKE '%${search}%' OR
                g.jv_ref_no             LIKE '%${search}%' OR
                g.status                LIKE '%${search}%' OR
                h.draft_bill_no         LIKE '%${search}%' OR
                h.draft_bill_date       LIKE '%${search}%' OR
                h.trip_no               LIKE '%${search}%' OR
                h.ascii_vendor_code     LIKE '%${search}%' OR
                h.vehicle_type          LIKE '%${search}%' OR
                h.total_charges         LIKE '%${search}%' OR
                g.jv_create_ref_no      LIKE '%${search}%' 
            )
        `
    }

    const count = await sequelize.query(
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

        INNER JOIN jv_detail_tbl g
        ON g.draft_bill_no = b.draft_bill_no
        AND g.ref_code = b.tms_reference_no

        LEFT JOIN (
            SELECT
                ax.draft_bill_no,
                ax.draft_bill_date,
                ax.trip_no,
                ax.vehicle_type,
                bx.tms_reference_no,
                ax.vendor,
                cx.ascii_vendor_code,
                ax.total_charges
            FROM
                rbdb_temp.draft_bill_hdr_tbl ax
                LEFT JOIN rbdb_temp.draft_bill_detail_tbl bx ON bx.draft_bill_no = ax.draft_bill_no
                LEFT JOIN rbdb_temp.vendor_tbl cx ON cx.vendor_code = ax.vendor
            WHERE
                1 = 1
                AND ax.location = 'Manila'
                AND ax.service_type = 'DF FCL'
                AND ax.contract_type = 'BUY'
                AND ax.status = 'DRAFT_BILL_POSTED'
        ) h 
        ON LEFT (h.tms_reference_no, LENGTH (h.tms_reference_no) - 1) = LEFT (b.tms_reference_no, LENGTH (b.tms_reference_no) - 1)
        AND h.draft_bill_no <> b.draft_bill_no

        WHERE 1=1
        AND a.location = 'Manila'
        AND a.service_type = 'DF FCL'
        AND a.contract_type = 'BUY'
        AND a.vendor = '99999'
        -- AND a.status = 'DRAFT_BILL'

        ${where}
        ;`, {
            type: Sequelize.QueryTypes.SELECT,
        }).then((result) => {
            return result.length > 0 ? result[0].count : null;
        });;

    const rows = await sequelize.query(`
        SELECT
            a.draft_bill_no         AS jvr_db_no,
            a.draft_bill_date       AS jvr_db_date,
            a.trip_no               AS jvr_trip_no,
            b.invoice_no            AS jvr_invoice_no,
            c.principal_name        AS jvr_customer_desc,
            d.service_type_desc     AS jvr_service_type_desc,
            a.location              AS jvr_location,
            e.vendor_description    AS jvr_vendor_desc,
            a.vehicle_type          AS jvr_vehicle_type,
            f.vehicle_id            AS jvr_vehicle_id,
            b.ship_from             AS jvr_ship_from,
            b.ship_to               AS jvr_ship_to,
            a.tariff_id             AS jvr_tariff_id,
            a.total_charges         AS jvr_total_charges,
            g.jv_ref_no				AS jv_create_ref_no,
            g.status				AS jv_status,

            h.draft_bill_no         AS jv_actual_cr,
            h.draft_bill_date       AS jv_actual_cr_date,
            h.trip_no               AS jv_actual_trip_number,
            h.ascii_vendor_code     AS jv_actual_vendor,
            h.vehicle_type          AS jv_actual_vehicle_type,
            h.total_charges         AS jv_actual_charges,            
            g.jv_create_ref_no		AS jv_reverse_ref_no,

            b.tms_reference_no      AS jvr_tms_reference_no,
            a.customer              AS jvr_customer_code,
            a.service_type          AS jvr_service_type_code,
            a.vendor                AS jvr_vendor_code
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

        INNER JOIN jv_detail_tbl g
        ON g.draft_bill_no = b.draft_bill_no
        AND g.ref_code = b.tms_reference_no

        LEFT JOIN (
            SELECT
                ax.draft_bill_no,
                ax.draft_bill_date,
                ax.trip_no,
                ax.vehicle_type,
                bx.tms_reference_no,
                ax.vendor,
                cx.ascii_vendor_code,
                ax.total_charges
            FROM
                rbdb_temp.draft_bill_hdr_tbl ax
                LEFT JOIN rbdb_temp.draft_bill_detail_tbl bx ON bx.draft_bill_no = ax.draft_bill_no
                LEFT JOIN rbdb_temp.vendor_tbl cx ON cx.vendor_code = ax.vendor
            WHERE
                1 = 1
                AND ax.location = 'Manila'
                AND ax.service_type = 'DF FCL'
                AND ax.contract_type = 'BUY'
                AND ax.status = 'DRAFT_BILL_POSTED'
        ) h 
        ON LEFT (h.tms_reference_no, LENGTH (h.tms_reference_no) - 1) = LEFT (b.tms_reference_no, LENGTH (b.tms_reference_no) - 1)
        AND h.draft_bill_no <> b.draft_bill_no

        WHERE 1=1
        AND a.location = 'Manila'
        AND a.service_type = 'DF FCL'
        AND a.contract_type = 'BUY'
        AND a.vendor = '99999'
        -- AND a.status = 'DRAFT_BILL'

        ${where}

        ORDER BY g.createdAt DESC

        LIMIT ${parseInt(page) * parseInt(totalPage)}, ${parseInt(totalPage)} 
        ;`, {
            type: Sequelize.QueryTypes.SELECT,
        });
      

    return {
        count: count,
        rows: rows,
        pageCount: Math.ceil(count/totalPage)
    }
}

const reverseJV = async(
    jv_data,
    processor_id
) => {
    const transaction = await sequelize.transaction();
    try {

        const acr = jv_data.map(row => row.jv_actual_cr);

        const jvr_detail_data = await getJVReversalDetails(acr);

        if(jv_data.length === 0) throw new Error('No data found.');

        let jvr_series = await getLastSeriesNumber({prefix: 'JVR' });
        if(jvr_series >= 999) throw new Error(`JV Reversal exceeded daily amount: 999.`);

        const jv_reversal_ref = jvHelper.generateSeries("JVR", jvr_series+1);

        const jv_reversal_filename = `${jv_reversal_ref}.xlsx`;

        const header_data = await getJVReversalHeader(jv_data, jv_reversal_ref);

        const processor_data = await getProcessorEmail(processor_id);

        const jvReversalWorkbook = await jvHelper.generateJVReversalExcel(header_data, jv_data, processor_data);
        const jv_header_insert = await jvHelper.formatJVRHeader(header_data, processor_id);

        const jv_detail_insert = await jvHelper.formatJVRDetail(jv_reversal_ref, jvr_detail_data, processor_id);

        await models.jv_header_tbl.create(
            jv_header_insert,
            {
                transaction: transaction
            }
        );

        await insertJVData({
            data: jv_detail_insert,
            targetTableName: "jv_detail_tbl",
            transaction: transaction
        });

        for (const row of jv_data) {
            await updateJVCRow(
                row.jv_actual_cr,
                row.jv_actual_vendor,
                row.jv_actual_charges,
                jv_reversal_ref,
                row.jv_create_ref_no,
                row.jvr_db_no,
                row.jvr_tms_reference_no,
                transaction
            );
        }

        await setSeriesNumber("JVR", jvr_series+1, transaction);

        let filepath = path.join(__dirname, '../../assets/reports/jv', jv_reversal_filename);

        await jvReversalWorkbook.xlsx.writeFile(filepath);
        const jvrContents = fs.readFileSync(filepath, { encoding: 'base64' });

        await transaction.commit();

        return {
            workbook: jvReversalWorkbook,
            filename: jv_reversal_filename
        }

    } catch (e) {
        await transaction?.rollback();
        console.log(e);
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

const getJVReversalDetails = async(
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

const getJVReversalHeader = async(
    detail_data,
    jv_ref
) => {
    try {

        const total_amount = _.sumBy(detail_data, item => parseInt(item.jv_actual_charges, 10));
        const cost_center = await sequelize.query(`
            SELECT ascii_service_type 
            FROM service_type_tbl
            WHERE service_type_code = '${_.chain(detail_data)
                .map('jvr_service_type_code')
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
                .map('jvr_location')
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

const exportJVC = async(jv_ref, processor_id) => {
    try {
        const header_data = await getExportHeaderData(jv_ref);
        if(!header_data) {
            throw new Error('No data found in database.')
        }

        const detail_data = await getExportDetailDataJVC(jv_ref);
        if(detail_data.length === 0) {
            throw new Error('No data found in database.')
        }

        const processor_data = await getProcessorEmail(processor_id);

        const filename = `${jv_ref}.xlsx`;
        const workbook = await jvHelper.generateJVCreationExcel(header_data, detail_data, processor_data);

        return {
            workbook: workbook,
            filename: filename
        }

    } catch (e) {
        console.log(e);
        throw e;
    }
    
}

const exportJVR = async(jv_ref, processor_id) => {
    try {
        const header_data = await getExportHeaderData(jv_ref);
        if(!header_data) {
            throw new Error('No data found in database.')
        }

        const detail_data = await getExportDetailDataJVR(jv_ref);
        if(detail_data.length === 0) {
            throw new Error('No data found in database.')
        }

        const processor_data = await getProcessorEmail(processor_id);

        const filename = `${jv_ref}.xlsx`;
        const workbook = await jvHelper.generateJVReversalExcel(header_data, detail_data, processor_data);

        return {
            workbook: workbook,
            filename: filename
        }

    } catch (e) {
        console.log(e);
        throw e;
    }
}

const getExportHeaderData = async(jv_ref) => {
    const results = await sequelize.query(
        'SELECT * FROM jv_header_tbl WHERE jv_ref_no = :value LIMIT 1',
        {
          replacements: { value: jv_ref },
          type: sequelize.QueryTypes.SELECT,
        }
      );
      
      const firstRow = results.length > 0 ? results[0] : null;
      return firstRow;
}

const getExportDetailDataJVC = async(jv_ref) => {
    try {
		return await sequelize.query(
            `SELECT 
                draft_bill_no,
                ref_code            AS tms_reference_no,
                destination_port    AS ship_from,
                delivery_location   AS ship_to,
                principal           AS customer,
                container_size      AS vehicle_type,
                container_no        AS vehicle_id,
                supplier_code       AS vendor,
                amount              AS total_charges
            FROM jv_detail_tbl
            WHERE jv_ref_no = '${jv_ref}'
            ORDER BY createdAt DESC;`,
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

const getExportDetailDataJVR = async(jv_ref) => {
    try {
		return await sequelize.query(
            `SELECT 
                draft_bill_no       AS jvr_db_no,
                ref_code            AS jvr_tms_reference_no,
                destination_port    AS jvr_ship_from,
                delivery_location   AS jvr_ship_to,
                principal           AS jvr_customer_code,
                container_size      AS jvr_vehicle_type,
                container_no        AS jvr_vehicle_id,
                supplier_code       AS jvr_vendor_code,
                amount              AS jvr_total_charges,
                cr_number           AS jv_actual_cr,
                actual_vendor       AS jv_actual_vendor,
                actual_charges      AS jv_actual_charges,
                jv_create_ref_no    AS jv_create_ref_no
            FROM jv_detail_tbl
            WHERE jv_create_ref_no = '${jv_ref}'
            ORDER BY createdAt DESC;`,
            {
                type: Sequelize.QueryTypes.SELECT,
            }).then((result) => {
                // Parse result and convert total_charges
                return result.map((row) => ({
                    ...row,
                    total_charges: row.total_charges !== null ? parseFloat(row.total_charges) : null,
                    actual_charges: row.actual_charges !== null ? parseFloat(row.actual_charges) : null,
                }));
			});
	} catch (e) {
		console.log(e);
		throw e;
	}
}

const updateJVCRow = async(
    cr_number,
    actual_vendor,
    actual_charges,
    reversal_ref,
    create_ref,
    db_no,
    tms_ref,
    transaction
) => {
    try {
        const update_row = await sequelize.query(`
            UPDATE jv_detail_tbl SET 
                cr_number = :cr_number,
                actual_vendor = :actual_vendor,
                actual_charges = :actual_charges,
                jv_create_ref_no = :reversal_ref,
                status = 'For Reversal'
            WHERE 
                jv_ref_no = :create_ref
                AND draft_bill_no = :db_no
                AND ref_code = :tms_ref
        `,
        {
            replacements: {
                cr_number,
                actual_vendor,
                actual_charges,
                reversal_ref,
                create_ref,
                db_no,
                tms_ref
            },
            type: sequelize.QueryTypes.UPDATE,
            transaction: transaction
        })
    } catch (e) {
        console.error(e);
        throw e;
    }
}


module.exports = {
    getJVReversal,
    reverseJV,
    exportJVC,
    exportJVR
}