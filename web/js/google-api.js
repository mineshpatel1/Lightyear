// Google Authentication
var google = require('googleapis');

var OAuth2 = google.auth.OAuth2;
var clientID = global.auth.google.client_id,
    clientSecret = global.auth.google.client_secret,
    redirectURL = global.auth.google.callback_url,
    profile = global.auth.google.analytics_profile;
var oauth2Client = new OAuth2(clientID, clientSecret, redirectURL);
var Analytics = google.analytics({ 'version' : 'v3', 'auth' : oauth2Client });

var googleScopes = ['https://www.googleapis.com/auth/analytics.readonly'];
var googleAuthUrl = oauth2Client.generateAuthUrl({
    access_type: 'online', // 'online' (default) or 'offline' (gets refresh_token)
    scope: googleScopes // If you only need one scope you can pass it as string
});

exports.authUrl = googleAuthUrl;
exports.client = oauth2Client;

/** Query the Analytics service */
exports.query = function(callback) {
    var params = {
        'start-date' : '7daysAgo',
        'end-date' : 'today',
        'metrics' : 'ga:sessions',
        'ids' : 'ga:' + profile
    };
    Analytics.data.ga.get(params, callback);
}
