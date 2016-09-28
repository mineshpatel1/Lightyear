var twitterApi = require('../server/api/twitter.js');
var $ = require('../server/api/general.js');

module.exports = function(app) {
    // Authenticate the Twitter API via OAuth2
    app.post('/auth/twitter', function(req, res) {
        twitterApi.requestToken(req.session, function(url) {
            res.status(200).send(url);
        }, function(err) {
            res.status(500).send(err);
        });
    });

    // Twitter callback for authentication
    app.get('/auth/twitter/callback', function(req, res) {
        var requestToken = req.query.oauth_token;
        var oauth_verifier = req.query.oauth_verifier;
        if (req.session.twitterSecret) {
            $.getUser(req, res, function(currentUser) {
                twitterApi.getAccessToken(currentUser, requestToken, req.session.twitterSecret, oauth_verifier, function() {
                    res.redirect('/');
                    res.end();
                });
            });
        } else {
            res.redirect('/');
            res.end();
        }
    });

    // Revokes Facebook access
    app.delete('/auth/twitter', function(req, res) {
        $.getUser(req, res, function(currentUser) {
            twitterApi.revokeAccess(currentUser, function(data) {
                res.status(200).send(data);
            }, function() {
                res.status(500).send('Could not revoke Twitter session.');
            });
        });
    });

    // Retrieved Twitter user information
    app.get('/twitter/user', function(req, res) {
        $.getUser(req, res, function(currentUser) {
            if (currentUser.twitter.accessToken) {
                var twitterUser = {
                    id : currentUser.twitter.id,
                    name : currentUser.twitter.name,
                    handle : currentUser.twitter.handle
                }
                res.status(200).send(twitterUser);
            } else {
                res.status(200).send(false);
            }
        });
    });
}
