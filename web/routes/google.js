var googleApi = require('../server/api/google.js');
var $ = require('../server/api/general.js');

module.exports = function(app) {
    // Authenticate the Google API via OAuth2
    app.post('/auth/google', function(req, res) {
        res.status(200).send(googleApi.authUrl);
    });

    // Revokes Google access
    app.delete('/auth/google', function(req, res) {
        $.getUser(req, res, function(currentUser) {
            googleApi.revokeAccess(currentUser, function() {
                res.status(200).send('OK');
            }, function() {
                res.status(500).send('Could not revoke Google session.');
            });
        });
    });

    // Callback for Google authentication, setting authorisation credentials
    app.get('/auth/google/callback', function(req, res) {
        var code = req.query.code;
        if (code) {
            $.getUser(req, res, function(currentUser) {
                googleApi.authUser(currentUser, code, function() {
                    res.redirect('/');
                    res.end();
                });
            });
        } else {
            res.redirect('/');
            res.end();
        }
    });

    // Get user information for the Google account
    app.get('/google/user', function(req, res) {
        $.getUser(req, res, function(currentUser) {
            if (googleApi.checkSession(currentUser)) {
                googleApi.getProfiles(currentUser, function(err, results) {
                    if (err) {
                        res.status(200).send({
                            'name' : currentUser.google.name,
                            'profiles' : [],
                            'profile' : '',
                            'defaultProfileID' : ''
                        });
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
    });
}
