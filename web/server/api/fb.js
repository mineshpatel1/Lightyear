https = require('https');

var accessToken = '';
var clientID = global.auth.facebook.client_id,
    clientSecret = global.auth.facebook.client_secret,
    callbackURL = global.auth.facebook.callback_url;

var fbURL = 'https://www.facebook.com/dialog/oauth?client_id=' + clientID;
fbURL += '&redirect_uri=' + callbackURL;
fbURL += '&scope=read_insights,manage_pages';

function parseResponse(response, callback) {
    var output = '';
    response.setEncoding('utf8');
    response.on('data', function(chunk) {
        output += chunk.toString('utf-8').trim();
    }).on('end', function() {
        callback(JSON.parse(output));
    });
}

exports.fbURL = fbURL;
// exports.accessToken = accessToken;

exports.checkSession = function(user) {
    if (user) {
        var token = user.facebook.token;
        if (token) {
            return true;
        } else {
            return false;
        }
    } else {
        return false;
    }
}

exports.query = function(accessToken, fields, callback) {
    var path = '/me?fields=' + fields.join(',');
    path += '&access_token=' + accessToken;

    var options = {
        host : 'graph.facebook.com',
        path : path,
        method : 'GET'
    }

    var req = https.request(options, function(res) {
        if (res.statusCode == 200) {
            parseResponse(res, function(results) {
                callback(false, results);
            })
        } else {
            callback(res, {});
        }

    });
    req.end();
    return true;
}

exports.userInfo = function(user, onSuccess, onError) {
    exports.query(user.facebook.token, ['id', 'name', 'accounts'], function(err, results) {
        if (err) {
            onError({});
        } else {
            var pages = results.accounts.data.map(function(acc) {
                return { 'access_token' : acc.access_token, 'id' : acc.id, 'name' : acc.name };
            });

            var output = {
                'id' : results.id,
                'name' : results.name,
                'pages' : pages
            }
            onSuccess(output);
        }
    });
}

// Revokes Facebook access, destroying the user access token
exports.revokeAccess = function(user, onSuccess, onError) {
    if (user) {
        var path = '/' + user.facebook.id + '/permissions';
        path += '?access_token=' + exports.accessToken;
        var options = {
            host : 'graph.facebook.com',
            path : path,
            method: 'DELETE'
        };

        var req = https.request(options, function(res) {
            if (res.statusCode == 200) {
                user.facebook.token = false;
                user.save(function(err) {
                    if (err) {
                        onError(err);
                    } else {
                        onSuccess();
                    }
                });
            } else {
                onError(res);
            }
        });
        req.end();
    }
};

exports.exchangeToken = function(code, user) {
    var path = '/v2.3/oauth/access_token?client_id=' + clientID;
    path += '&client_secret=' + clientSecret;
    path += '&redirect_uri=' + callbackURL;
    path += '&code=' + code;

    var options = {
        host : 'graph.facebook.com',
        path : path,
        method: 'GET'
    };

    var req = https.request(options, function (res) {
        if (res.statusCode == 200) {
            parseResponse(res, function(results) {
                exports.accessToken = results.access_token;
                user.facebook.token = results.access_token;

                exports.userInfo(function(output) {
                    user.facebook.id = output.id;
                    user.facebook.name = output.name;
                    user.save();
                });
            });
        }
    });
    req.end();
}
