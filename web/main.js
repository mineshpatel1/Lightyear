// Global constants
global.SERVER = 'lyf.com';
global.PORT = 8080;
global.auth = require(__dirname + '/config/auth.json');

var express = require('express'),
    http = require('http'),
    https = require('https'),
    path = require('path'),
    mongoose = require('mongoose'),
    bodyParser = require('body-parser');

var app = express();
app.use(bodyParser.json());

var fbApi = require('./server/api/fb.js');
var googleApi = require('./server/api/google.js');

// Initialise MongoDB
mongoose.connect('mongodb://localhost/lyf');
var User = require('./server/models/users.js');

app.use('/lib', express.static(__dirname + '/node_modules'));
app.use('/css', express.static(__dirname + '/app/css'));
app.use('/controllers', express.static(__dirname + '/app/controllers'));

// Application view routes
app.get('/', function (req, res) {
   res.sendFile(__dirname + "/app/views/index.html");
});

app.get('/login', function (req, res) {
   res.sendFile(__dirname + "/app/views/login.html");
});

// Local authentication
app.post('/auth/local', function (req, res) {
    var creds = req.body;

    User.findOne({ email : creds.email }, function(err, user) {
        if (err) throw err;

        if (!user) {
            res.status(403).send('No user with email ' + creds.email + ' found.');
        } else {
            if (user.validPassword(creds.password)) {
                res.send('OK');
            } else {
                res.status(401).send('Invalid password.')
            }
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
            console.log('New user: ' + creds.email + ' created.');
            res.send('OK');
        }
    });
})

// Authenticate the Google API via OAuth2
app.get('/auth/google', function(req, res) {
    res.send(googleApi.authUrl);
});

app.get('/auth/facebook', function(req, res) {
    res.send(fbApi.fbURL);
});

app.get('/auth/facebook/callback', function(req, res) {
    var code = req.query.code;
    fbApi.exchangeToken(code);
    res.redirect('/');
    res.end();
});

// Facebook query
app.get('/facebook/analytics', function(req, res) {
    var loggedIn = fbApi.query(['id', 'accounts'], function(err, results) {
        if (err) {
            res.status(500);
            res.send(err);
        } else {
            res.send(results);
        }
    });

    if (!loggedIn) {
        res.status(401);
        res.send({ error: 'Not logged in to Facebook', authUrl: '/auth/facebook' });
    }
});

// Facebook query
app.get('/facebook/analytics/pages', function(req, res) {
    var loggedIn = fbApi.query(['id', 'accounts'], function(err, results) {
        if (err) {
            res.status(500);
            res.send(err);
        } else {
            res.send(results.accounts.data);
        }
    });

    if (!loggedIn) {
        res.status(401);
        res.send({ error: 'Not logged in to Facebook', authUrl: '/auth/facebook' });
    }
});

// Callback for Google authentication, setting authorisation credentials
app.get('/auth/google/callback', function(req, res) {
    var code = req.query.code;
    googleApi.client.getToken(code, function(err, tokens){
        googleApi.client.setCredentials(tokens);
    });
    res.redirect('/');
    res.end();
});

// On failure, send the authorisation URL
function googleError(response, err) {
    if (err) {
        response.status(401);
        response.send({ error: String(err), authUrl: googleApi.authUrl });
    }
}

// Query Google Analytics
app.get('/google/analytics', function(req, res) {
    googleApi.query(function(err, results) {
        if (err) { // On failure, send the authorisation URL
            googleError(res, err);
        } else {
            res.send(results.rows[0]);
        }
    });
});

// Get Google Analytics profiles
app.get('/google/analytics/profiles', function(req, res) {
    googleApi.getProfiles(function(err, results) {
        if (err) {
            googleError(res, err);
        } else {
            res.send(results);
        }
    });
});

// Start server
var server = app.listen(global.PORT, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("Lightyear app listening at http://%s:%s", host, port)
});
