const draftBill = require('./draft-bill.validation');
const {contract_tariff} = require('./contract.validation');
const {transmittal} = require('./data-export.validation');
const {tariff, tariff_approve} = require('./tariff.validation');

module.exports = {
    'draft-bill': draftBill,
    'contract-tariff': contract_tariff,
    'export-transmittal': transmittal,
    'tariff': tariff,
    'tariff-approve': tariff_approve
}