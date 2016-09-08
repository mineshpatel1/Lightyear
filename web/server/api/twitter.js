// Twitter Authentication
var https = require('https');
var twitterAPI = require('node-twitter-api');
var twitter = new twitterAPI({
    consumerKey: global.auth.twitter.consumer_key,
    consumerSecret: global.auth.twitter.consumer_secret,
    callback: global.auth.twitter.callback_url,
    x_auth_access_type: 'read'
});

exports.authUrl = '';

// Requests an access token from Twitter
exports.requestToken = function(session, onSuccess, onError) {
    twitter.getRequestToken(function(error, requestToken, requestTokenSecret, results){
        if (error) {
            console.log(error);
            if (onError) {
                onError(error);
            }
        } else {
            var authUrl = twitter.getAuthUrl(requestToken);
            session.twitterToken = requestToken;
            session.twitterSecret = requestTokenSecret;
            onSuccess(authUrl);
        }
    });
}

// Gets an access token for Twitter authentication
exports.getAccessToken = function(user, requestToken, requestTokenSecret, oauth_verifier, callback) {
    twitter.getAccessToken(requestToken, requestTokenSecret, oauth_verifier, function(error, accessToken, accessTokenSecret, results) {
        if (error) {
            callback();
        } else {
            user.twitter.accessToken = accessToken;
            user.twitter.accessTokenSecret = accessTokenSecret;
            twitter.verifyCredentials(accessToken, accessTokenSecret, {}, function(error, data, response) {
                if (error) {
                    console.log('Could not get Twitter access token: ' + error);
                    callback();
                } else {
                    user.twitter.id = data.id;
                    user.twitter.handle = data.screen_name;
                    user.twitter.name = data.name;
                    user.save(function() {
                        callback();
                    });
                }
            });

        }
    });
};

// Checks the validity of a Twitter session and returns some user information
exports.checkSession = function(user, callback) {
    if (user) {
        twitter.verifyCredentials(user.twitter.accessToken, user.twitter.accessTokenSecret, {}, function(error, data, response) {
            if (error) {
                callback(error);
            } else {
                callback(false, data);
            }
        });
    } else {
        return callback(true);
    }
}

// Invalidates a Twitter token, revoking access
exports.revokeAccess = function(user, onSuccess, onError) {
    user.twitter = {};
    user.save(function(err) {
        if (err) {
            onError(err)
        } else {
            onSuccess();
        }
    });
}
