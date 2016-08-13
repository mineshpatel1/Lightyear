// Google Authentication
var google = require('googleapis');
var key = require(__dirname + '/../keys/google-client.json');

var OAuth2 = google.auth.OAuth2;
var CLIENT_ID = key.web.client_id,
    CLIENT_SECRET = key.web.client_secret,
    REDIRECT_URL = 'http://' + global.SERVER + ':' + global.PORT + '/oauth2',
    PROFILE = key.web.profile;
var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
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
        'ids' : 'ga:' + PROFILE
    };
    Analytics.data.ga.get(params, callback);
}
