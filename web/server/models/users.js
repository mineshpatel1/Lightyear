var mongo = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// New user schema
var userSchema = new mongo.Schema({
    displayName: String,
    email: { type: String, required: true, unique: true },
    password: String,
    google: {
        id: String,
        name: String,
        token: Object,
        defaultProfileID: String
    },
    facebook: {
        id: String,
        name: String,
        token: String,
        defaultPageID: String
    },
    twitter: {
        name: String,
        accessToken: String,
        accessTokenSecret: String
    },
    created: Date,
    updated: Date
});

// Hash password using BCrypt
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password);
};

// Checking if password is valid
userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.password);
};

// Create the model for users and expose it to our app
module.exports = mongo.model('User', userSchema);
