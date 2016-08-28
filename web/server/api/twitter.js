// Twitter Authentication
var twitterAPI = require('node-twitter-api');
var twitter = new twitterAPI({
    consumerKey: global.auth.twitter.consumer_key,
    consumerSecret: global.auth.twitter.consumer_secret,
    callback: global.auth.twitter.callback_url,
    x_auth_access_type: 'read'
});

exports.authUrl = '';
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

exports.getAccessToken = function(user, requestToken, requestTokenSecret, oauth_verifier, callback) {
    twitter.getAccessToken(requestToken, requestTokenSecret, oauth_verifier, function(error, accessToken, accessTokenSecret, results) {
        if (error) {
            callback();
        } else {
            user.twitter.accessToken = accessToken;
            user.twitter.accessTokenSecret = accessTokenSecret;
            user.save(function() {
                callback();
            });
        }
    });
};

exports.checkSession = function(user, callback) {
    if (user) {
        twitter.verifyCredentials
    } else {
        return callback(false);
    }
}
