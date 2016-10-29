var expect    = require("chai").expect;
var request = require('supertest');
var app = require('../main.js');
var url = 'http://lyf.com:8080';
var agent = request.agent(url);

describe('Login process', function() {
    it('should login', function(done){
        var creds = { 'email': 'test@test.com', 'password': 'abc12345' }
        agent.post('/auth/local')
            .send(creds)
            .expect(200)
            .end(function(err, res) {
                done(err);
            });
    });

    it('should not redirect', function(done){
        agent.get('/')
            .expect(200)
            .end(function(err, res) {
                done(err);
            });
    });

    it('should logoff and redirect', function(done) {
        agent.get('/auth/local/logoff')
            .expect(302)
            .end(function(err, res) {
                expect(res.header.location).to.equal('/login');
                done(err);
            });
    });
});
