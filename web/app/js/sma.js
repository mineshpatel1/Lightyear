/**
 * @overview Social Media Analytics
 * @version 1.00
 * @author Minesh Patel
*/

/**
	* Contains functions and classes for the social media analytics application.
*/
var sma = (function(sma) {

    sma.Config = {
        Locale : 'GB',
        DataFormats : {
            'double' : '.3s',
            'numeric' : '.3s',
            'integer' : '.0f',
            'date' : '%d/%m/%Y',
            'varchar' : '%s'
        },
        SIPrefixes : {
            'k' : 'k', // Kilo (10^3)
            'M' : 'M', // Mega (10^6)
            'G' : 'G' // Giga (10^9)
        },
        Palettes : {
            'Flat-UI' : ['#3598DC', '#2FCC71', '#E84C3D', '#34495E', '#E77E23', '#9C59B8'],
            'Flat-UI-Soft' : ['#5DA5DA', '#60BD68', '#F15854', '#4D4D4D', '#FAA43A', '#B276B2'],
            'Cool-Scale' : ['#BEE0CC', '#70C3D0', '#419DC5', '#316BA7', '#223B89', '#151E5E'],
            'Warm-Scale' : ['#FDEB73', '#F6C15B', '#ED9445', '#E66731', '#B84A29', '#6A3A2D'],
            'Heatmap' : ['#0066FF', '#00F0FF', '#00FF19', '#EBFF00', '#FF0000']
        },
        Fonts : [
            'Arial',
            'Arial Black',
            'Book Antiqua',
            'Bookman Old Style',
            'Century Gothic',
            'Consolas',
            'Courier New',
            'Fantasy',
            'Georgia',
            'Helvetica',
            'Impact',
            'King',
            'Modena',
            'Open Sans',
            'Tahoma',
            'Times New Roman',
            'Trebuchet MS',
            'Verdana'
        ]
    };

    sma.Connectors = {
        ga: { name : 'Google Analytics' },
        fb: { name : 'Facbeook' },
        tw: { name : 'Twitter' },
        db_pg: { name : 'Database (PostgreSQL)' }
    }

    /**
        * @class
        Class for the datasets used in the application.
        Defines the query as well as holding the data itself.
    */
    sma.Dataset = function(conns, type, name, query) {
        /** Type of the dataset, describing the connection type (Database, Twtitter, Google etc.). */
        this.Type = type || '';

        /** Name of the dataset. */
        this.Name = name || '';

        /** Query for the dataset. The structure of this object changes depending on the type. */
        this.Query = query || {
            Schema: conns.postgre.defaultSchema || '',
            Criteria: []
        };

        /** Array of objects representing the data for the dataset. */
        this.Data = [];

        /** Returns the object but without the data array. */
        this.noData = function() {
            return {
                Type : this.Type,
                Name : this.Name,
                Query : this.Query
            };
        }
    }

    /**
		* @class
		* Column object.
		* @param {string} code Column code, typically of the form "Table"."Column" but can also be a formula.
		* @param {string} name Column name.
		* @param {string} [dataType=varchar] OBIEE defined data type. Can be one of `varchar`, `integer`, `double`, `date`..
		* @param {string} [aggRule=none] Aggregation rule, e.g.`none`, `sum`, `avg`.
		* @param {string} [dataFormat=this.getDefaultFormat] Specify a D3 data formatting string.
		* @param {object} [config={}] Column specific configuration object.
        * @param {string} [locale=sma.Config.Locale] Locality code for the column.
	*/
	sma.BIColumn = function(code, name, dataType, aggRule, dataFormat, config, locale) {
		/** Column code. */
		this.Code = code;

		/** Column name. */
		this.Name = name;

		/** Data type. */
		this.DataType = dataType || 'varchar';

		/** Aggregation rule, e.g.`none`, `sum`, `avg`. */
		this.Measure = aggRule || "none";

		/** Column ID, defined as Table.Name. */
		this.ID = this.Code;

		/** Holds the column ID of a sort column if one has been defined. */
		this.SortKey = false;

		/**
			Generates default D3 format string based on the OBIEE datatype via a simple switch. E.g. `double` produces a format of `.3s`.
			@returns {String} D3 format string
		*/
		this.getDefaultFormat = function() {
			var formatString;
			switch(this.DataType) {
				case 'double':
					formatString = sma.Config.DataFormats.double;
					break;
				case 'numeric':
					formatString = sma.Config.DataFormats.numeric;
					break;
				case 'integer':
					formatString = sma.Config.DataFormats.integer;
					break;
				case 'date':
					formatString = sma.Config.DataFormats.date;
					break;
				case 'varchar':
					formatString = sma.Config.DataFormats.varchar;
					break;
				default:
					formatString = '%s';
					break;
			}
			return formatString;
		}

		/** Locality of the column for formatting purposes. Defaults to `rmvpp.defaults.locale`. */
		this.Locale = locale || sma.Config.Locale;

		/** D3 data format string. Defaults using `getDefaultFormat`. */
		this.DataFormat = dataFormat || this.getDefaultFormat();

		/**
			Formats a value using D3
			@param value Value to be formatted
			@param {String} [formatString=this.DataFormat] D3 format string to format with
			@returns Formatted value.
		*/
		this.format = function(value, formatString) {
			formatString = formatString || this.DataFormat;
			var formatted = value, locale = this.Locale;

			function customAbbrev(formatString, value) {
				var s = rmvpp.locales[locale].numberFormat(formatString)(value);
			    switch (s[s.length - 1]) {
					case "k":
						if (sma.Config.SIPrefixes.hasOwnProperty('k'))
							s = s.slice(0, -1) + sma.Config.SIPrefixes.k;
						break;
					case "M":
						if (sma.Config.SIPrefixes.hasOwnProperty('M'))
							s = s.slice(0, -1) + sma.Config.SIPrefixes.M;
						break;
			    	case "G":
						if (sma.Config.SIPrefixes.hasOwnProperty('G'))
							s = s.slice(0, -1) + sma.Config.SIPrefixes.G;
						break;
			    }
			    return s;
			}

			function numFormat(formatString, value) {
			    if (value) {
					if (formatString.indexOf('s') > -1) {
						return customAbbrev(formatString, value);
					} else
			        	return rmvpp.locales[locale].numberFormat(formatString)(value);
			    } else {
			        return '';
			    }
			}

			// console.log(this.Name, this.DataType);
			switch(this.DataType) {

			    case 'double': formatted = numFormat(formatString, value); break;
			    case 'integer': formatted = numFormat(formatString, value); break;
			    case 'numeric': formatted = numFormat(formatString, value); break;
				case 'date':
					var dateValue;
					if (value instanceof Date)
						dateValue = value;
					else
						dateValue = rmvpp.locales[this.Locale].timeFormat("%Y-%m-%d").parse(value); // Returns a Date
					formatted = rmvpp.locales[this.Locale].timeFormat(formatString)(dateValue);
					break;
				case 'varchar':
					if (formatString != '%s' && formatString)
						formatted = formatString.replace(/%s/g, value);
					break;
				default:
					break;
			}
			return formatted;
		}

		var column = this;

		/** Contains all column and plugin specific configuration information. Parameters specified by `columnMappingParameters` on plugins. */
		this.Config = config || {};
	}

    return sma;
}(sma || {}));

// Exports the module for Node applications
if (typeof(exports) != 'undefined') {
    exports.api = sma;
}
