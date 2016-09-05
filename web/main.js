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

var currentUser;

// Initialise MongoDB
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

// Checks if session is authorised and redirects to login page if not
function checkAuth(req, res, callback) {
    if (!req.session.user) {
        res.redirect('/login');
    } else {
        // Load user profile from the database
        User.findOne({ email : req.session.user }, function(err, user) {
            if (err) {
                console.log('User could not be found in database');
                callback();
            } else {
                var promises = [];
                currentUser = user; // Set global user

                // Facebook session check
                if (!fbApi.checkSession(currentUser)) {
                    currentUser.facebook.token = false;
                }

                // Google session check
                var googleDef = q.defer(); // Wait on asynchronous functions
                promises.push(googleDef.promise);

                if (currentUser.google) {
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
                        currentUser.twitter = {};
                        currentUser.save();
                    }
                    twitterDef.resolve();
                })

                q.allSettled(promises).then(function() {
                    callback();
                })
            }
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
    currentUser.google.defaultProfileID = req.body.google.profile;
    currentUser.facebook.defaultPageID = req.body.facebook.page;
    currentUser.save(function(err) {
        if (err) {
            res.status(500).send('Could not save default connection settings.');
        } else {
            res.status(200).send('OK');
        }
    });
})

// Login to Facebook
app.get('/auth/facebook', function(req, res) {
    res.status(200).send(fbApi.fbURL);
});

app.get('/auth/facebook/callback', function(req, res) {
    var code = req.query.code;
    fbApi.exchangeToken(code, currentUser);
    res.redirect('/');
    res.end();
});

// Facebook query
app.get('/facebook/analytics', function(req, res) {
    var loggedIn = fbApi.query(['id', 'accounts'], function(err, results) {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).send(results);
        }
    });

    if (!loggedIn) {
        res.status(401).send({ error: 'Not logged in to Facebook', authUrl: '/auth/facebook' });
    }
});

// Facebook query
app.get('/facebook/analytics/pages', function(req, res) {
    var loggedIn = fbApi.query(['id', 'accounts'], function(err, results) {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).send(results.accounts.data);
        }
    });

    if (!loggedIn) {
        res.status(401).send({ error: 'Not logged in to Facebook', authUrl: '/auth/facebook' });
    }
});

// Facebook user information
app.get('/facebook/user', function(req, res) {
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

// Revokes Facebook access
app.get('/auth/facebook/revoke', function(req, res) {
    fbApi.revokeAccess(currentUser, function() {
        res.status(200).send('OK');
    }, function() {
        res.status(500).send('Could not revoke Facebook session.');
    });
});

// Authenticate the Google API via OAuth2
app.get('/auth/google', function(req, res) {
    res.status(200).send(googleApi.authUrl);
});

// Revokes Google access
app.get('/auth/google/revoke', function(req, res) {
    googleApi.revokeAccess(currentUser, function() {
        res.status(200).send('OK');
    }, function() {
        res.status(500).send('Could not revoke Google session.');
    });
});

// Callback for Google authentication, setting authorisation credentials
app.get('/auth/google/callback', function(req, res) {
    var code = req.query.code;
    if (code) {
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
    } else {
        res.redirect('/');
        res.end();
    }
});

// Query Google Analytics
app.get('/google/analytics', function(req, res) {
    googleApi.query(function(err, results) {
        if (err) { // On failure, send the authorisation URL
            googleError(res, err);
        } else {
            res.status(200).send(results.rows[0]);
        }
    });
});

// Get user information for the Google account
app.get('/google/user', function(req, res) {
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

// On failure, send the authorisation URL
function googleError(response, err) {
    if (err) {
        response.status(401);
        response.send({ error: String(err), authUrl: googleApi.authUrl });
    }
}

// Authenticate the Twitter API via OAuth2
app.get('/auth/twitter', function(req, res) {
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
    req.session.twitterSecret;

    twitterApi.getAccessToken(currentUser, requestToken, req.session.twitterSecret, oauth_verifier, function() {
        res.redirect('/');
        res.end();
    });
});

// Retrieved Twitter user information
app.get('/twitter/user', function(req, res) {
    if (currentUser.twitter.accessToken) {
        var twitterUser = {
            id : currentUser.twitter.id,
            name : currentUser.twitter.name,
            handle : currentUser.twitter.handle
        }
        res.status(200).send(twitterUser);
    } else {
        res.status(500).send('Twitter not authenticated.');
    }
});

// Revokes Facebook access
app.get('/auth/twitter/revoke', function(req, res) {
    twitterApi.revokeAccess(currentUser, function(data) {
        res.status(200).send(data);
    }, function() {
        res.status(500).send('Could not revoke Twitter session.');
    });
});

// Start server
var server = app.listen(global.PORT, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("Lightyear app listening at http://%s:%s", host, port)
});
