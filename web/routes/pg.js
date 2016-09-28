var pgApi = require('../server/api/pg.js');
var $ = require('../server/api/general.js');

module.exports = function(app) {
    // Retrieved PostgreSQL user/db information
    app.get('/postgre/user', function(req, res) {
        $.getUser(req, res, function(currentUser) {
            pgApi.checkSession(currentUser, function(err, schemas) {
                if (err) {
                    res.status(200).send(false);
                } else {
                    var dbUser = {
                        name : currentUser.postgre.username,
                        hostname : currentUser.postgre.hostname,
                        port : currentUser.postgre.port,
                        db : currentUser.postgre.db,
                        defaultSchema : currentUser.postgre.defaultSchema,
                        schemas : schemas,
                        schema : currentUser.postgre.defaultSchema || schemas[0]
                    }
                    res.status(200).send(dbUser);
                }
            });
        });
    });

    // Retrieved PostgreSQL user/db information
    app.post('/postgre/user', function(req, res) {
        var db = req.body;

        $.getUser(req, res, function(currentUser) {
            // Encrypt user entered password
            db.password = currentUser.encrypt(db.password);
            var sampleUser = { postgre: db, decrypt: currentUser.decrypt }; // Create a dummy user to test connectivity
            pgApi.checkSession(sampleUser, function(err, data) {
                if (err) {
                    console.log(err);
                    res.status(500).send(err);
                } else {
                    currentUser.postgre = db;
                    currentUser.save();
                    var out = currentUser.postgre;
                    out.schemas = data;
                    res.status(200).send(out);
                }
            });
        });
    });

    // Retrieves PostgreSQL user/db information
    app.delete('/postgre/user', function(req, res) {
        $.getUser(req, res, function(currentUser) {
            currentUser.postgre = {};
            currentUser.save(function(err) {
                if (err) {
                    res.status(500).send();
                } else {
                    res.status(200).send();
                }
            });
        });
    });

    // Query PostgreSQL database
    app.post('/postgre/query', function(req, res) {
        var query = req.body.query;
        $.getUser(req, res, function(currentUser) {
            pgApi.executeSQL(query, currentUser, function(err, data) {
                if (err) {
                    res.status(500).send(err);
                } else {
                    res.status(200).send(data);
                }
            });
        });
    });
}
