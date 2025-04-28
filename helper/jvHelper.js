const path = require('path');
const excel = require('exceljs');
const moment = require('moment');

const formatValue = (value) => {
    return (isNaN(value) || !isFinite(value)) ? 0 : parseFloat(parseFloat(value).toFixed(2));
}

exports.formatJVCHeader = async(
    header_data,
    processor_id
) => ({
    ...header_data,
    status: 'For Creation',
    created_by: processor_id
});

exports.formatJVCDetail = async(
    jv_ref,
    detail_data,
    processor_id
) => {
    return detail_data.map((row, index) => {
        return {
            jv_ref_no: jv_ref,
            draft_bill_no: row.draft_bill_no,
            ref_code: row.tms_reference_no,
            destination_port: row.ship_to,
            delivery_location: row.location,
            principal: row.customer,
            container_size: row.vehicle_type,
            container_no: row.vehicle_id,
            supplier_code: row.vendor,
            amount: formatValue(row.total_charges),
            created_by: processor_id
        }
    });
}

exports.generateSeries= (prefix, last_number) => {
    const [year, month, day] = new Date().toISOString().split('T')[0].split('-');
    const dateKey = `${year.slice(2)}${month}${day}`;
  
    let numberSeries = last_number.toString().padStart(3, "0"); // 001, 002, etc.
    return `${prefix}${dateKey}${numberSeries}`;
  }

exports.generateJVCreationExcel = async(
    header_data,
    detail_data,
    processor_data
) => {
    const template = path.join(__dirname, '../assets/templates', 'jv_creation_template.xlsx')
    const workbook = new excel.Workbook();

    await workbook.xlsx.readFile(template);
    
    // Header worksheet
    const worksheet = workbook.getWorksheet(1);
    
    if (!worksheet) {
        throw new Error("Worksheet not found in the workbook.");
    }

    //header data
    worksheet.getRow(7).getCell('B').value = `${header_data?.jv_ref_no}`;
    worksheet.getRow(8).getCell('B').value = header_data?.total_amount;
    worksheet.getRow(9).getCell('B').value = `${header_data?.cost_center}`;
    worksheet.getRow(10).getCell('B').value = `${header_data?.location}`;
    worksheet.getRow(11).getCell('B').value = `${header_data?.service_type}`;
    worksheet.getRow(12).getCell('B').value = `${header_data?.department_code}`;

    const columns = [
        {
            header: "Draft Bill Number",
            cell: "A",
            key: "draft_bill_no"
        },
        {
            header: "Ref Code",
            cell: "B",
            key: "tms_reference_no"
        },
        {
            header: "Destination Port",
            cell: "C",
            key: "ship_from"
        },
        {
            header: "Delivery Location",
            cell: "D",
            key: "ship_to"
        },
        {
            header: "Principal",
            cell: "E",
            key: "customer"
        },
        {
            header: "Container Size",
            cell: "F",
            key: "vehicle_type"
        },
        {
            header: "Container No.",
            cell: "G",
            key: "vehicle_id"
        },
        {
            header: "Supplier Code",
            cell: "H",
            key: "vendor"
        },
        {
            header: "Amount",
            cell: "I",
            key: "total_charges"
        }
    ];

    let rowIndex = 15;

    const floatColumns = ['I'];
    
    //insert rows
    detail_data.map((row) => {
        const dataRow = worksheet.getRow(rowIndex);
        columns.map((column) => {
            dataRow.getCell(column.cell).value = typeof column.key !== "undefined" ? row[column.key] : null;
            if(floatColumns.includes(column.cell)){
                dataRow.getCell(column.cell).numFmt = '#,##0.00';
            }
        });
        rowIndex++;
    });

    worksheet.eachRow({ includeEmpty: true }, (row, Number) => {
        if (Number > 14) {
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
                cell.alignment = { vertical: 'middle' };
            });
        }
    });

    const footer1RowIndex = rowIndex + 2;
    const footer1Row = worksheet.getRow(footer1RowIndex);
    const footerDate = moment();
    footer1Row.getCell(9).value = `Report Generation Date: ${footerDate.format('MMMM DD, YYYY - h:mm:ss a')}`;
    footer1Row.getCell(9).alignment = {
        horizontal: 'right'
    }
    
    const footer2RowIndex = rowIndex + 3;
    const footer2Row = worksheet.getRow(footer2RowIndex);
    footer2Row.getCell(9).value = `Report Printed By: ${processor_data}`;
    footer2Row.getCell(9).alignment = {
        horizontal: 'right'
    }

    const footer3RowIndex = rowIndex + 4;
    const footer3Row = worksheet.getRow(footer3RowIndex);
    footer3Row.getCell(9).value = `Printed Via: RATA`;
    footer3Row.getCell(9).alignment = {
        horizontal: 'right'
    }
    
    const footer4RowIndex = rowIndex + 5;
    const footer4Row = worksheet.getRow(footer4RowIndex);
    footer4Row.getCell(9).value = `Source System: RATA`;
    footer4Row.getCell(9).alignment = {
        horizontal: 'right'
    }

    return workbook;

}

