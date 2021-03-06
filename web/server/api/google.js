var google = require('googleapis');
var q = require('q');
var sma = require('../../app/js/sma.js'); // Social Media Analytics classes

var OAuth2 = google.auth.OAuth2;
var clientID = global.auth.google.client_id,
    clientSecret = global.auth.google.client_secret,
    redirectURL = global.auth.google.callback_url;
var oauth2Client = new OAuth2(clientID, clientSecret, redirectURL);
var Analytics = google.analytics({ 'version' : 'v3', 'auth' : oauth2Client });
var Auth = google.oauth2({ 'version' : 'v1', 'auth' : oauth2Client });

var googleScopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/analytics.readonly'
];

var googleAuthUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
    scope: googleScopes // If you only need one scope you can pass it as string
});

// Sets up a Google client on the fly for a given user
function getClient(user) {
    if (!user.google) {
        user.google = {};
    }

    if (!user.google.client) {
        var clientID = global.auth.google.client_id,
            clientSecret = global.auth.google.client_secret,
            redirectURL = global.auth.google.callback_url;

        user.google.client = new OAuth2(clientID, clientSecret, redirectURL);

        if (user.google.token) {
            user.google.client.setCredentials({
                "access_token" : user.google.token.access_token,
                "refresh_token" : user.google.token.refresh_token
            });
        }
    }
    return user.google.client;
}

exports.authUrl = googleAuthUrl;

/** Query the Analytics service */
exports.query = function(user, profile, dims, metrics, startDate, endDate, callback) {

    // Convert dates to YYYY-MM-DD
    startDate = sma.api.convertToYYYYMMDD(startDate);
    endDate = sma.api.convertToYYYYMMDD(endDate);

    startDate = startDate || '7daysAgo';
    endDate = endDate || 'today';
    metrics = metrics.join(',');
    dims = dims.join(',');

    var Analytics = google.analytics({ 'version' : 'v3', 'auth' : getClient(user) });
    var params = {
        'start-date' : startDate,
        'end-date' : endDate,
        'metrics' : metrics,
        'dimensions' : dims,
        'ids' : 'ga:' + profile
    };
    Analytics.data.ga.get(params, callback);
}

// Authenticate Google User
exports.authUser = function(user, code, callback) {
    getClient(user).getToken(code, function(err, tokens) {
        user.google.token = tokens;
        user.save(function() {
            exports.userInfo(user, function(err, googleUser) {
                if (err) {
                    callback();
                } else {
                    user.google.id = googleUser.id;
                    user.google.name = googleUser.name;
                    user.save(function() {
                        callback();
                    });
                }
            });
        });
    });
}

// Get Google Analytics profiles
exports.getProfiles = function(user, callback) {
    var Analytics = google.analytics({ 'version' : 'v3', 'auth' : getClient(user) });
    Analytics.management.accountSummaries.list({}, function(err, accounts) {
        if (!err) {
            var promises = []; // Set up promise array so query is returned with all profiles
            var profiles = [];

            accounts.items.forEach(function(account) {
                var defer = q.defer();
                promises.push(defer.promise);

                // Fetch Google Analytics profiles (views)
                Analytics.management.profiles.list( {
                    accountId : account.id ,
                    webPropertyId : account.webProperties[0].id
                }, function(err, results) {
                    if (!err) {
                        results.items.forEach(function(profile) {
                            var newProfile = profile;
                            newProfile.fullName = account.name + ' - ' + profile.name;
                            profiles.push(newProfile);
                        });
                    }

                    defer.resolve();
                });
            });

            q.allSettled(promises).then(function() {
                callback(err, profiles);
            });
        } else {
            callback(err);
        }
    });
}

// Checks the session of a user's Google token
exports.checkSession = function(user) {
    if (user) {
        var token = user.google.token;
        if (token) {
            var currTime = new Date().valueOf();
            return currTime < token.expiry_date;
        } else {
            return false;
        }
    } else {
        return false;
    }
}

// Get user information for the Google session
exports.userInfo = function(user, callback) {
    Auth = google.oauth2({ 'version' : 'v1', 'auth' : getClient(user) });
    Auth.userinfo.get(function(err, results) {
        callback(err, results)
    });
}

// Refresh access token
exports.refreshToken = function(user, onSuccess, onError) {
    getClient(user).refreshAccessToken(function(err, tokens) {
        if (err && onError) {
            console.log(err);
            onError();
        } else {
            user.google.token = tokens;
            user.save(); // Asynchronously save the token
            onSuccess();
        }
    });
};

// Expires the token for the given user
exports.revokeAccess = function(user, onSuccess, onError) {
    getClient(user).revokeToken(user.google.token.access_token, function(err, results) {
        if (err) {
            console.log(err);
            onError();
        } else {
            user.google.token = false;
            user.save(function(err) {
                if (err) {
                    onError(err);
                } else {
                    onSuccess();
                }
            });
        }
    })
}
