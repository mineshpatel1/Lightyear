var express = require("express");
var app = express();

app.use('/scripts', express.static(__dirname + '/node_modules'));
app.use('/controllers', express.static(__dirname + '/app/controllers'));
app.get('/', function (req, res) {
   res.sendFile( __dirname + "/app/pages/index.html");
})

var server = app.listen(8081, function () {
  var host = server.address().address
  var port = server.address().port
  console.log("Example app listening at http://%s:%s", host, port)
})
