// Global constants
global.SERVER = 'lyf.com';
global.PORT = 8080;
global.auth = require(__dirname + '/config/auth.json');

var express = require('express'),
    http = require('http'),
    https = require('https'),
    path = require('path'),
    $ = require('jquery');

var app = express();

var passport = require('passport');
var fbApi = require('./js/fb-api.js')
var googleApi = require('./js/google-api.js')

app.use('/lib', express.static(__dirname + '/node_modules'));
app.use('/controllers', express.static(__dirname + '/app/controllers'));

app.get('/', function (req, res) {
   res.sendFile(__dirname + "/app/views/index.html");
});

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

    // Redirect to homepage
    res.statusCode = 302;
    res.setHeader("Location", "/");
    res.end();
});

// Facebook query
app.get('/facebook/analytics', function(req, res) {
    var loggedIn = fbApi.query(function(err, results) {
        if (err) {
            console.log(err);
        } else {
            console.log(results);
        }
    });

    if (!loggedIn) {
        // Redirect to homepage
        res.status(500);
        res.send({ error: 'Not logged in to Facebook', authUrl: '/auth/facebook' });
        res.end();
    }
});

// Callback for Google authentication, setting authorisation credentials
app.get('/auth/google/callback', function(req, res) {
    var code = req.query.code;
    googleApi.client.getToken(code, function(err, tokens){
        googleApi.client.setCredentials(tokens);
    });

    // Redirect to homepage
    res.statusCode = 302;
    res.setHeader("Location", "/");
    res.end();
});

// Query Google Analytics
app.get('/google/analytics', function(req, res) {
    googleApi.query(function(err, results) {
        if (err) { // On failure, send the authorisation URL
            res.status(500);
            res.send({ error: String(err), authUrl: googleApi.authUrl });
        } else {
            res.send(results.rows[0]);
        }
    });
});

// Start server
var server = app.listen(global.PORT, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("Lightyear app listening at http://%s:%s", host, port)
});
