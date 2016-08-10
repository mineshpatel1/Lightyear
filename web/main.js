// Global constants
global.SERVER = 'lyf.com';
global.PORT = 8080;

var express = require('express'),
    http = require('http'),
    path = require('path'),
    $ = require('jquery');

var googleApi = require('./js/google-api.js')
var app = express();

app.use('/lib', express.static(__dirname + '/node_modules'));
app.use('/controllers', express.static(__dirname + '/app/controllers'));

app.get('/', function (req, res) {
   res.sendFile( __dirname + "/app/pages/index.html");
});

// Authenticate the Google API via OAuth2
app.get('/auth/google', function(req, res) {
    res.send(googleApi.authUrl);
});

// Callback for Google authentication, setting authorisation credentials
app.get('/oauth2', function(req, res) {
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
var server = app.listen(global.PORT, global.SERVER, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("Lightyear app listening at http://%s:%s", host, port)
});
