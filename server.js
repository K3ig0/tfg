var express = require('express')
, app = express()
, port = 8988;


// routing
app.get('/', function(req, res) {
	res.sendFile(__dirname + '/client_browser/index.html');
})


// server listening port
app.listen(port, function () {
  console.log('Server listening goes on localhost listening at port: %s', port);
});
