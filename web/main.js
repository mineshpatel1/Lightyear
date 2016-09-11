// Global constants
global.SERVER = 'lyf.com';
global.PORT = 8080;
global.auth = require(__dirname + '/config/auth.json');

var express = require('express'),
    q = require('q'),
    http = require('http'),
    https = require('https'),
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
var sma = require('./app/js/sma.js'); // Social Media Analytics classes

var User = require('./server/models/users.js');

// Application view routes
app.get('/', function (req, res) {
    checkAuth(req, res, function() {
        res.sendFile(__dirname + "/app/views/index.html");
    });
});

// Login page for the application
app.get('/login', function (req, res) {
    if (req.session.user) {
        res.redirect('/');
    } else {
        res.sendFile(__dirname + "/app/views/login.html");
    }
});

// Retrieves the current user from the session and passes it to the callback
function getUser(req, callback) {
    if (!req.session.user) {
        res.redirect('/login');
    } else {
        User.findOne({ email : req.session.user }, function(err, user) {
            if (err) {
                console.log('User: ' + req.session.user + 'could not be found in database.');
                res.redirect('/login');
            } else {
                callback(user);
            }
        });
    }
}

// Checks if session is authorised and redirects to login page if not
function checkAuth(req, res, callback) {
    if (!req.session.user) {
        res.redirect('/login');
    } else {
        getUser(req, function(currentUser) {
            var promises = [];

            // Facebook session check
            if (!fbApi.checkSession(currentUser)) {
                currentUser.facebook.token = false;
            }

            // Google session check
            var googleDef = q.defer(); // Wait on asynchronous functions
            promises.push(googleDef.promise);

            if (currentUser.google.token) {
                googleApi.client.setCredentials({
                    "access_token" : currentUser.google.token.access_token,
                    "refresh_token" : currentUser.google.token.refresh_token
                });

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
                callback();
            });
        });
    }
}

// Local authentication
app.post('/auth/local', function (req, res) {
    var creds = req.body;

    User.findOne({ email : creds.email }, function(err, user) {
        if (err) throw err;

        if (!user) {
            res.status(403).send('No user with email ' + creds.email + ' found.');
        } else {
            if (user.validPassword(creds.password)) {
                req.session.user = creds.email;
                res.status(200).send('OK');
            } else {
                res.status(401).send('Incorrect password for ' + creds.email + '.')
            }
        }
    });
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

// Local registration
app.post('/auth/local/register', function(req, res) {
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
                res.status(403).send('User already exists.');
            } else {
                res.status(500).send(errMsg);
            }
        } else {
            req.session.user = creds.email;
            console.log('New user: ' + creds.email + ' created.');
            res.status(200).send('OK');
        }
    });
})

app.post('/settings/connections', function(req, res) {
    getUser(req, function(currentUser) {
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

// Login to Facebook
app.post('/auth/facebook', function(req, res) {
    res.status(200).send(fbApi.fbURL);
});

app.get('/auth/facebook/callback', function(req, res) {
    var code = req.query.code;
    fbApi.exchangeToken(code, currentUser, function() {
        res.redirect('/');
        res.end();
    });
});

// Revokes Facebook access
app.delete('/auth/facebook', function(req, res) {
    fbApi.revokeAccess(currentUser, function() {
        res.status(200).send('OK');
    }, function() {
        res.status(500).send('Could not revoke Facebook session.');
    });
});

// Facebook query
// app.get('/facebook/analytics', function(req, res) {
//     var loggedIn = fbApi.query(['id', 'accounts'], function(err, results) {
//         if (err) {
//             res.status(500).send(err);
//         } else {
//             res.status(200).send(results);
//         }
//     });
//
//     if (!loggedIn) {
//         res.status(401).send({ error: 'Not logged in to Facebook', authUrl: '/auth/facebook' });
//     }
// });

// Facebook user information
app.get('/facebook/user', function(req, res) {
    getUser(req, function(currentUser) {
        if (fbApi.checkSession(currentUser)) {
            fbApi.userInfo(currentUser, function(data) {
                data.page = currentUser.facebook.defaultPageID || data.pages[0].id;
                res.status(200).send(data);
            }, function() {
                res.status(200).send(false);
            })
        } else {
            res.status(200).send(false)
        }
    });
});

// Authenticate the Google API via OAuth2
app.post('/auth/google', function(req, res) {
    res.status(200).send(googleApi.authUrl);
});

// Revokes Google access
app.delete('/auth/google', function(req, res) {
    getUser(req, function(currentUser) {
        googleApi.revokeAccess(currentUser, function() {
            res.status(200).send('OK');
        }, function() {
            res.status(500).send('Could not revoke Google session.');
        });
    });
});

// Callback for Google authentication, setting authorisation credentials
app.get('/auth/google/callback', function(req, res) {
    var code = req.query.code;
    if (code) {
        getUser(req, function(currentUser) {
            googleApi.client.getToken(code, function(err, tokens) {
                currentUser.google.token = tokens;
                currentUser.save();
                googleApi.client.setCredentials({
                    "access_token": tokens.access_token,
                    "refresh_token" : tokens.refresh_token
                });
                googleApi.userInfo(function(err, googleUser) {
                    if (err) {
                        res.redirect('/');
                        res.end();
                    } else {
                        currentUser.google.id = googleUser.id;
                        currentUser.google.name = googleUser.name;
                        currentUser.save(function() {
                            res.redirect('/');
                            res.end();
                        });
                    }
                });
            });
        });
    } else {
        res.redirect('/');
        res.end();
    }
});

// Get user information for the Google account
app.get('/google/user', function(req, res) {
    getUser(req, function(currentUser) {
        if (googleApi.checkSession(currentUser)) {
            googleApi.getProfiles(function(err, results) {
                if (err) {
                    res.status(200).send(false);
                } else {
                    var profiles = results.map(function(r) {
                        return { 'name' : r.name, 'id': r.id };
                    });

                    res.status(200).send({
                        'name' : currentUser.google.name,
                        'profiles' : profiles,
                        'profile' : currentUser.google.defaultProfileID || profiles[0].id,
                        'defaultProfileID' : currentUser.google.defaultProfileID
                    });
                }
            });
        } else {
            res.status(200).send(false);
        }
    });
});

// On failure, send the authorisation URL
function googleError(response, err) {
    if (err) {
        response.status(401);
        response.send({ error: String(err), authUrl: googleApi.authUrl });
    }
}

// Authenticate the Twitter API via OAuth2
app.post('/auth/twitter', function(req, res) {
    twitterApi.requestToken(req.session, function(url) {
        res.status(200).send(url);
    }, function(err) {
        res.status(500).send(err);
    });
});

// Twitter callback for authentication
app.get('/auth/twitter/callback', function(req, res) {
    var requestToken = req.query.oauth_token;
    var oauth_verifier = req.query.oauth_verifier;
    if (req.session.twitterSecret) {
        getUser(req, function(currentUser) {
            twitterApi.getAccessToken(currentUser, requestToken, req.session.twitterSecret, oauth_verifier, function() {
                res.redirect('/');
                res.end();
            });
        });
    } else {
        res.redirect('/');
        res.end();
    }
});

// Revokes Facebook access
app.delete('/auth/twitter', function(req, res) {
    getUser(req, function(currentUser) {
        twitterApi.revokeAccess(currentUser, function(data) {
            res.status(200).send(data);
        }, function() {
            res.status(500).send('Could not revoke Twitter session.');
        });
    });
});

// Retrieved Twitter user information
app.get('/twitter/user', function(req, res) {
    getUser(req, function(currentUser) {
        if (currentUser.twitter.accessToken) {
            var twitterUser = {
                id : currentUser.twitter.id,
                name : currentUser.twitter.name,
                handle : currentUser.twitter.handle
            }
            res.status(200).send(twitterUser);
        } else {
            res.status(200).send(false);
        }
    });
});

// Retrieved PostgreSQL user/db information
app.get('/postgre/user', function(req, res) {
    getUser(req, function(currentUser) {
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

    getUser(req, function(currentUser) {
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
    getUser(req, function(currentUser) {
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
    getUser(req, function(currentUser) {
        pgApi.executeSQL(query, currentUser, function(err, data) {
            if (err) {
                res.status(500).send(err);
            } else {
                res.status(200).send(data);
            }
        });
    });
});

// Generic query, server can decide from the object how to proceed
app.post('/query', function(req, res) {
    var dataReq = req.body;
    getUser(req, function(currentUser) {
        switch(dataReq.Type) {
            case 'db_pg':
                pgApi.setSchema(dataReq.Query.Schema, currentUser, function(err) {
                    pgApi.executeSQL(dataReq.Query.sql, currentUser, function(err, data) {
                        if (err) {
                            res.status(500).send(err);
                        } else {
                            var criteria = [];
                            data.fields.forEach(function(col) {
                                var newCol = new sma.api.BIColumn(col.name, col.name.replace('_', ' ').toProperCase(), pgApi.convertType(col.dataTypeID), pgApi.softAggRule(col.name));
                                criteria.push(newCol);
                            });
                            data.Criteria = criteria;
                            res.status(200).send(data);
                        }
                    })
                });
                break;
            default:
                res.status(200).send();
                break;
        }
    });
});

// Get user's datasets
app.get('/datasets', function(req, res) {
    getUser(req, function(currentUser) {
        res.status(200).send(currentUser.datasets);
    });
});

// Save user's datasets
app.post('/datasets', function(req, res) {
    getUser(req, function(currentUser) {
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

String.prototype.toProperCase = function (plural) {
	var string = this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	if (plural) {
		if (string[string.length-1] != 's')
			string += 's';
	}
    return string;
};
