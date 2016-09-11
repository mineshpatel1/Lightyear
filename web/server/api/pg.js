pg = require('pg');

// Data type parsing
var types = require('pg').types
types.setTypeParser(1700, 'text', parseFloat);
types.setTypeParser(20, 'text', parseInt);

// Creates a connection pool using the user specified database
function createPool(user) {
    var config = {
        user: user.postgre.username,
        database: user.postgre.db,
        password: user.decrypt(user.postgre.password),
        host: user.postgre.hostname, // Server hosting the postgres database
        port: user.postgre.port, //env var: PGPORT
        max: 10, // max number of clients in the pool
        idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
    };
    return new pg.Pool(config);
}

exports.executeSQL = function(query, user, callback) {
    // If no user details specified, fail
    if (user.postgre.username) {

        // If a client pool hasn't been assigned to the user, create one.
        if (!user.postgre.pool) {
            user.postgre.pool = createPool(user);
        }

        user.postgre.pool.query(query, function (err, result) {
            if (err) {
                if (callback)
                    callback(err);
            } else {
                if (callback)
                    callback(false, result);
            }
        });
    } else {
        if (callback)
            callback(true);
    }
}

// Checks the users session against the PostgreSQL database they have configured
// Returns schemas available to the user
exports.checkSession = function(user, callback) {
    exports.executeSQL("select schema_name from information_schema.schemata", user, function(err, data) {
        if (err) {
            callback(err);
        } else {
            var schemas = data.rows.map(function(d) { return d.schema_name; });
            callback(false, schemas);
        }
    })
}

// Converts integer data type to string value. Run the SQL below for full OID to type listing
// select typname, oid, typarray from pg_type order by oid;
exports.convertType = function(type) {
    var varchar_types = [18, 19, 25, 1002, 1003, 1042, 1043];
    var int_types = [20, 21, 22, 23, 1005, 1006, 1007];
    var double_types = [700, 701, 1021, 1022, 1700];
    var date_types = [1082, 1083, 1114, 1115];

    if (varchar_types.indexOf(type) > -1) {
        return 'varchar';
    } else if (int_types.indexOf(type) > -1) {
        return 'integer';
    } else if (double_types.indexOf(type) > -1) {
        return 'double';
    } else if (date_types.indexOf(type) > -1) {
        return 'date';
    } else {    // Otherwise assume string
        return 'varchar';
    }
}

// Sets the schema search path for the user
exports.setSchema = function(schema, user, callback) {
    exports.executeSQL("set search_path to " + schema, user, callback);
}
