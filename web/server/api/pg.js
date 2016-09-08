pg = require('pg');

function executeSQL(query, user, callback) {
    var pgUrl = 'postgres://';
    pgUrl += user.postgre.username;
    pgUrl += '@' + user.postgre.hostname;
    pgUrl += ':' + user.postgre.port;
    pgUrl += '/' + user.postgre.db;

    var pgClient = new pg.Client(pgUrl);
    pgClient.connect(function(err) {
        if (err) {
            callback(err);
        } else {
            // Get schema names
            pgClient.query(query, function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    pgClient.end(function (err) {
                        if (err) {
                            callback(err)
                        } else {
                            callback(false, result);
                        }
                    });
                }
            });
        }
    });
}

// Checks the users session against the PostgreSQL database they have configured
// Returns schemas available to the user
exports.checkSession = function(user, callback) {
    executeSQL("select schema_name from information_schema.schemata", user, function(err, data) {
        if (err) {
            callback(err);
        } else {
            var schemas = data.rows.map(function(d) { return d.schema_name; });
            callback(false, schemas);
        }
    })
}
