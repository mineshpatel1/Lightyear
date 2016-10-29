var fbApi = require('../server/api/fb.js');
var $ = require('../server/api/general.js');

module.exports = function(app) {
    // Login to Facebook
    app.post('/auth/facebook', function(req, res) {
        res.status(200).send(fbApi.fbURL);
    });

    // Callback from Facebook authentication
    app.get('/auth/facebook/callback', function(req, res) {
        var code = req.query.code;
        $.getUser(req, res, function(currentUser) {
            fbApi.exchangeToken(code, currentUser, function() {
                res.redirect('/');
                res.end();
            });
        });
    });

    // Revokes Facebook access
    app.delete('/auth/facebook', function(req, res) {
        $.getUser(req, res, function(currentUser) {
            fbApi.revokeAccess(currentUser, function() {
                res.status(200).send('OK');
            }, function() {
                res.status(500).send('Could not revoke Facebook session.');
            });
        });
    });

    // Facebook user information
    app.get('/facebook/user', function(req, res) {
        $.getUser(req, res, function(currentUser) {
            if (fbApi.checkSession(currentUser)) {
                fbApi.userInfo(currentUser, function(data) {
                    data.defaultPageID = currentUser.facebook.defaultPageID;
                    data.page = currentUser.facebook.defaultPageID || data.pages[0].id;
                    res.status(200).send(data);
                }, function() {
                    res.status(200).send(false);
                })
            } else {
                res.status(200).send(false)
            }
        });
    });
}
