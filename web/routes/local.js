var pgApi = require('../server/api/pg.js');
var User = require('../server/models/users.js');
var $ = require('../server/api/general.js');

module.exports = function(app) {
    // Local authentication
    app.post('/auth/local', function (req, res) {
        var creds = req.body;

        User.findOne({ email : creds.email }, function(err, user) {
            if (err) throw err;

            if (!user) {
                res.status(500).send('No user with email ' + creds.email + ' found.');
            } else {
                if (user.validPassword(creds.password)) {
                    req.session.user = creds.email;
                    res.status(200).send();
                } else {
                    res.status(401).send('Incorrect password for ' + creds.email + '.')
                }
            }
        });
    });

    // Local registration
    app.post('/local/user', function(req, res) {
        var creds = req.body;

        var newUser = User(creds);
        newUser.password = newUser.generateHash(creds.password);
        newUser.save(function(err) {
            if (err) {
                var errMsg;

                if (err.toJSON) {
                    errMsg = err.toJSON().errmsg;
                } else {
                    errMsg = err.message;
                }

                if (errMsg.indexOf('duplicate key error') > -1) {
                    res.status(500).send('User already exists.');
                } else {
                    res.status(500).send(errMsg);
                }
            } else {
                req.session.user = creds.email;
                console.log('New user: ' + creds.email + ' created.');
                res.status(200).send('OK');
            }
        });
    });

    // Get user profile
    app.get('/local/user', function(req, res) {
        $.getUser(req, res, function(currentUser) {
            res.status(200).send(currentUser);
        })
    });

    // Logout and end the user's session
    app.get('/auth/local/logoff', function(req, res) {
        req.session.destroy(function(err) {
            if (err) {
                res.status(500).send(err);
            } else {
                res.redirect('/login');
            }
        });
    });

    // Saves connection setting parameters
    app.post('/settings/connections', function(req, res) {
        $.getUser(req, res, function(currentUser) {
            currentUser.google.defaultProfileID = req.body.google.profile;
            currentUser.facebook.defaultPageID = req.body.facebook.page;
            currentUser.postgre.defaultSchema = req.body.postgre.schema;
            pgApi.setSchema(currentUser.postgre.defaultSchema, currentUser); // Sets the schema search path

            currentUser.save(function(err) {
                if (err) {
                    res.status(500).send('Could not save default connection settings.');
                } else {
                    res.status(200).send('OK');
                }
            });
        });
    })
}
