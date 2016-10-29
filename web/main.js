// Global constants
global.SERVER = 'lyf.com';
global.PORT = 8080;
global.auth = require(__dirname + '/config/auth.json');

var express = require('express'),
    q = require('q'),
    path = require('path'),
    mongo = require('mongoose'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    MongoStore = require('connect-mongo')(session);

mongo.connect('mongodb://localhost/lyf');

var sessionOpts = {
    saveUninitialized: false, // Saved new sessions
    resave: false, // Do not automatically write to the session store
    secret: global.auth.session_secret,
    cookie : { httpOnly: true, maxAge: 86400000 },
    store: new MongoStore({ mongooseConnection: mongo.connection })
}

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Put static resources before the session declaration
app.use('/lib', express.static(__dirname + '/node_modules'));
app.use('/app', express.static(__dirname + '/app'));

app.use(cookieParser(global.auth.session_secret));
app.use(session(sessionOpts));

var fbApi = require('./server/api/fb.js');
var googleApi = require('./server/api/google.js');
var twitterApi = require('./server/api/twitter.js');
var pgApi = require('./server/api/pg.js');
var sma = require('./app/js/sma.js');
var $ = require('./server/api/general.js');

var User = require('./server/models/users.js');

// Application view routes
// Home page
app.get('/', function (req, res) {

    // Check if the session is valid for each connection type
    if (!req.session.user) {
        res.redirect('/login');
    } else {
        $.getUser(req, res, function(currentUser) {
            var promises = [];

            // Facebook session check
            if (!fbApi.checkSession(currentUser)) {
                currentUser.facebook.token = false;
            }

            // Google session check
            var googleDef = q.defer(); // Wait on asynchronous functions
            promises.push(googleDef.promise);

            if (currentUser.google.token) {
                if (googleApi.checkSession(currentUser)) {
                    googleDef.resolve();
                } else { // If it's expired, try to refresh the token
                    googleApi.refreshToken(currentUser, function() {
                        googleDef.resolve();
                    }, function() {
                        googleDef.resolve();
                    })
                }
            } else {
                googleDef.resolve();
            }

            var twitterDef = q.defer();
            promises.push(twitterDef.promise);
            twitterApi.checkSession(currentUser, function(error, data) {
                if (error) {
                    error = JSON.parse(error.data);
                    // Remove the user's twitter credentials unless it is for a rate limit excess (code 88)
                    if (!error.errors[0].code == 88) {
                        currentUser.twitter = {};
                        currentUser.save();
                    }
                }
                twitterDef.resolve();
            });

            // Set the schema search path
            if (currentUser.postgre.defaultSchema) {
                var pgDef = q.defer();
                promises.push(pgDef.promise);
                pgApi.setSchema(currentUser.postgre.defaultSchema, currentUser, function(err) {
                    pgDef.resolve();
                });
            }

            q.allSettled(promises).then(function() {
                res.sendFile(__dirname + "/app/views/index.html");
            });
        });
    }
});

// Login page
app.get('/login', function (req, res) {
    if (req.session.user) {
        res.redirect('/');
    } else {
        res.sendFile(__dirname + "/app/views/login.html");
    }
});

require('./routes/local')(app); // Local authentication management
require('./routes/fb')(app); // Facebook authentication management
require('./routes/google')(app); // Google authentication management
require('./routes/twitter')(app); // Twitter authentication management
require('./routes/pg')(app); // Google authentication management


// PostgreSQL query
function pgQuery(res, dataReq, currentUser) {
    pgApi.setSchema(dataReq.Query.Schema, currentUser, function(err) {
        pgApi.executeSQL(dataReq.Query.sql, currentUser, function(err, data) {
            if (err) {
                err.msg = err.message;
                res.status(500).send(err);
            } else {
                var criteria = [], dates = [];
                data.fields.forEach(function(col) {
                    var newCol = new sma.api.BIColumn(col.name, $.toProperCase(col.name.replace('_', ' ')), pgApi.convertType(col.dataTypeID), pgApi.softAggRule(col.name));
                    criteria.push(newCol);

                    if (col.dataTypeID == 1082) {
                        dates.push(col.name);
                    }
                });
                data.Criteria = criteria;

                // Convert dates to YYYY-MM-DD if they exist
                if (dates.length > 0) {
                    data.rows.forEach(function(row) {
                        dates.forEach(function(dt) {
                            row[dt] = row[dt].toISOString().slice(0,10)
                        });
                    });
                }

                res.status(200).send(data);
            }
        })
    });
}

// Google Analytics query
function gaQuery(res, dataReq, currentUser) {
    googleApi.query(currentUser, dataReq.Query.Profile, dataReq.Query.Dimensions, dataReq.Query.Measures, dataReq.Query.StartDate, dataReq.Query.EndDate, function(err, data) {
        if (err) {
            res.status(500).send(err);
        } else {
            var criteria = [];
            data.columnHeaders.forEach(function(col) {

                // Get column name from the configuration
                var colName = '', aggRule = 'none';
                if (col.columnType == 'DIMENSION') {
                    colName = sma.api.Config.GADims[col.name];
                } else {
                    colName = sma.api.Config.GAMeasures[col.name].name;
                    aggRule = sma.api.Config.GAMeasures[col.name].aggRule;
                }

                // Translate the data type
                var dataType = col.dataType.toLowerCase();
                if (dataType == 'time') {
                    dataType = 'double'; // Durations come through as TIME by default
                }

                var newCol = new sma.api.BIColumn(col.name, colName, dataType);
                criteria.push(newCol);
            });

            data.raw_rows = data.rows;

            data.rows.forEach(function(datum, i) {
                datum = {};
                data.columnHeaders.forEach(function(col, j) {
                    datum[col.name] = data.raw_rows[i][j];

                    // Convert date into YYYY-MM-DD
                    if (col.name == 'ga:date') {
                        datum[col.name] = datum[col.name].substr(0,4) + '-' + datum[col.name].substr(4,2) + '-' + datum[col.name].substr(6,2);
                    }
                });
                data.rows[i] = datum;
            });

            data.Criteria = criteria;
            res.status(200).send(data);
        }
    });
}

// Facebook Insights query
function fbQuery(res, dataReq, currentUser) {
    var grain = sma.api.Config.FBMeasures[dataReq.Query.Measures[0]].grain;

    var period = grain, hasDim = false;
    if (['city', 'country', 'gender_age'].indexOf(period) != -1) {
        period = 'lifetime';
        hasDim = true;
    }

    fbApi.insights_query(dataReq.Token, dataReq.Query.Measures, period, dataReq.Query.StartDate, dataReq.Query.EndDate, function(err, data) {
        if (err) {
            err.msg = err.error.message;
            res.status(500).send(err);
        } else {
            data.rows = [];

            if (!hasDim) { // Regular measure aggregates
                data.data[0].values.forEach(function(val, i) {
                    var row = {};

                    row['date'] = val['end_time'].slice(0, 10); // YYYY-MM-DD Date
                    data.data.forEach(function(set) {
                        row[set.name] = set.values[i].value;
                    });
                    data.rows.push(row);
                });
            } else { // Flatten structure for those with attribute data too
                data.data.forEach(function(set) {
                    set.values.forEach(function(val) {
                        for (dim in val.value) {
                            var row = {};
                            row['date'] = val['end_time'].slice(0, 10); // YYYY-MM-DD Date

                            if (grain != 'gender_age') { // Handle gender and age specially
                                row[grain] = dim;
                            } else {
                                row['gender'] = dim.split('.')[0];
                                row['age'] = dim.split('.')[1];
                            }

                            row[set.name] = val.value[dim];
                            data.rows.push(row);
                        }
                    });
                });
            }

            // Create the criteria array for column definitions
            var criteria = [];
            criteria.push(new sma.api.BIColumn('date', 'Date', 'string'));

            if (hasDim) { // Add the dimension attribute to the criteria
                if (grain != 'gender_age') { // Handle gender and age specially
                    criteria.push(new sma.api.BIColumn(grain, grain.toProperCase(), 'string'));
                } else {
                    criteria.push(new sma.api.BIColumn('gender', 'Gender', 'string'));
                    criteria.push(new sma.api.BIColumn('age', 'Age Group', 'string'));
                }
            }

            data.data.forEach(function(set, i) {
                if (hasDim) { // Only integer values available with dimensionable aggregates
                    var type = 'integer';
                } else {
                    var type = data.data[i].values[0].value % 1 === 0 ? 'integer' : 'double';
                }
                criteria.push(new sma.api.BIColumn(set.name, set.title, type));
            });
            data.Criteria = criteria;
            res.status(200).send(data);
        }
    });
}

// Generic query, server can decide from the object how to proceed
app.post('/query', function(req, res) {
    var dataReq = req.body;
    $.getUser(req, res, function(currentUser) {
        switch(dataReq.Type) {
            case 'postgre':
                pgQuery(res, dataReq, currentUser);
                break;
            case 'google':
                gaQuery(res, dataReq, currentUser);
                break;
            case 'facebook':
                fbQuery(res, dataReq, currentUser);
                break;
            default:
                res.status(200).send();
                break;
        }
    });
});

// Get user's datasets
app.get('/datasets', function(req, res) {
    $.getUser(req, res, function(currentUser) {
        res.status(200).send(currentUser.datasets);
    });
});

// Save user's datasets
app.post('/datasets', function(req, res) {
    $.getUser(req, res, function(currentUser) {
        currentUser.datasets = req.body;
        currentUser.save(function(err) {
            if (err) {
                res.status(500).send(err);
            } else {
                res.status(200).send();
            }
        });
    });
});

// Start server
var server = app.listen(global.PORT, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("Lightyear app listening at http://%s:%s", host, port)
});
