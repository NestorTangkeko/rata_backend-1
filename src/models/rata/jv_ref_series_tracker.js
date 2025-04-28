const {Model,Sequelize,DataTypes} = require('sequelize');

class jv_ref_series_tracker extends Model {
    static init (sequelize) {
        return super.init({
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4
            },
            prefix: {
                type: DataTypes.STRING,
                allowNull: false
            },
            date_key: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            last_number: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            }
	},
	{   
        timestamps: false,
		freezeTableName: true,
        sequelize,
		hasTrigger: true,
        indexes: [
            {
                unique: true,
                fields: ["prefix", "date_key"]
            }
        ]
	})}
}

module.exports = jv_ref_series_tracker;