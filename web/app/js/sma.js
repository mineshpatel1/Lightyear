/**
 * @overview Social Media Analytics
 * @version 1.00
 * @author Minesh Patel
*/

/**
	* Contains functions an classes
*/
var sma = (function(sma) {

    /** List of possible connectors available to the system. */
    sma.Connectors = [];

    var ga = {
        id : 'ga',
        name : 'Google Analytics'
    }
    sma.Connectors.push(ga);

    var fb = {
        id : 'fb',
        name : 'Facebook'
    }
    sma.Connectors.push(fb);

    var tw = {
        id : 'twitter',
        name : 'Twitter'
    }
    sma.Connectors.push(tw);

    var pg = {
        id : 'db_pg',
        name: 'Database (PostgreSQL)'
    }
    sma.Connectors.push(pg);

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
            schema: conns.postgre.defaultSchema || ''
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

    return sma;
}(sma || {}));
