pg = require('pg');

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

// Sets the schema search path for the user
exports.setSchema = function(schema, user, callback) {
    exports.executeSQL("set search_path to " + schema, user, callback);
}
