var mongo = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');
var crypto = require("crypto"), algorithm = 'aes-256-ctr', key = global.auth.encryptionKey;

// New user schema
var userSchema = new mongo.Schema({
    displayName: String,
    email: { type: String, required: true, unique: true },
    password: String,
    postgre: {
        db: String,
        hostname: String,
        username: String,
        password: String,
        port: Number,
        defaultSchema: String
    },
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
        id: String,
        name: String,
        handle: String,
        accessToken: String,
        accessTokenSecret: String
    },
    created: Date,
    updated: Date
});

// Hash password using BCrypt (irreversible)
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password);
};

// Checking if password is valid
userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.password);
};

// Encrypt text (reversible)
userSchema.methods.encrypt = function(text){
  var cipher = crypto.createCipher(algorithm, key)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}

// Decrypt text
userSchema.methods.decrypt = function(text){
  var decipher = crypto.createDecipher(algorithm, key)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}

// Create the model for users and expose it to our app
module.exports = mongo.model('User', userSchema);
