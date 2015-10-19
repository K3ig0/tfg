var express = require('express'),
	app = express(),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	port = 8988,

	users = [];


//express.static is a middleware to serve files
app.use('/', express.static(__dirname + '/client_browser'));

//server listening port
http.listen(port, function () {
  console.log('Server listening goes on localhost listening at port: %s', port);
});


//handling events
io.on('connection', function(socket){

	socket.on('login', function(userName){
		if (users.indexOf(userName) == -1) {
			users.push(userName);
			socket.userName = userName;
			socket.emit('login', users);
			socket.broadcast.emit('new user', userName);
		}
		else
			socket.emit('login', false); 
	});

	//when the client emits 'chat message'
	socket.on('chat message', function(msg){
		//sends this message to everyone except the client (broadcast)
		socket.broadcast.emit('chat message', '<b>' + socket.userName + ':</b> ' + msg);
  	});

	socket.on('disconnect', function(){
		if (socket.userName != undefined) {
			var pos = users.indexOf(socket.userName);
			users.splice(pos, 1);
			socket.broadcast.emit('user disconnected', socket.userName, pos);
		}
	});
});