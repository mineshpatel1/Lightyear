var User = require('../models/users.js');

// Retrieves the current user from the session and passes it to the callback
exports.getUser = function(req, res, callback) {
    if (!req.session.user) {
        res.redirect('/login');
    } else {
        User.findOne({ email : req.session.user }, function(err, user) {
            if (err) {
                console.log('User: ' + req.session.user + 'could not be found in database.');
                res.redirect('/login');
            } else {
                callback(user);
            }
        });
    }
}

// Capitilises first letter each word in the string
exports.toProperCase = function (str) {
	var string = str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    return string;
};
