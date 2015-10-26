var express = require('express'),
	app = express(),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	port = 8988,

	rooms = [];


//express.static is a middleware to serve files
app.use('/', express.static(__dirname + '/client_browser'));

//server listening port
http.listen(port, function () {
  console.log('Server listening goes on localhost listening at port: %s', port);
});


//handling events
io.on('connection', function(socket){

	//*** NEW ROOM ***
	//when a client emits 'new room'
	socket.on('new room', function(userName, roomName){
		var roomId;

		if (roomName != null)
			roomId = roomName;
		else
			//generating a room id
			roomId = randomAlphanumeric(5);

		//if the room id already exists -> generate a new id
		while (rooms[roomId] != undefined)
			if (roomName == null)
				roomId = randomAlphanumeric(5);
			else {
				//roomName already exists!
				socket.emit ('created room', false);
				return;
			}

		//store the username in the socket session for this client
		socket.userName = userName;

		//store the room name in the socket session for this client
		socket.roomId = roomId;

		//add the room id generated and the username to the global list
		rooms[roomId] = {members: [userName]};

		//send client to the new room
		socket.join(roomId);

		//send client his room id
		socket.emit('created room', roomId);
	});

	//*** JOIN ROOM ***
	//when a client emits 'join room'
	socket.on('join room', function(userName, roomId){
		//roomName not found
		if (rooms[roomId] == undefined) {
			socket.emit('joined room', 1);
			return;
		}
		//userName already exists? unique?
		else if (findMember(roomId, userName) != -1) {
			socket.emit('joined room', 0);
			return;
		}

		//store the username in the socket session for this client
		socket.userName = userName;

		//store the room name in the socket session for this client
		socket.roomId = roomId;

		//add the user to the list of members of the room in the rooms global list
		rooms[roomId]['members'].push(userName);

		//send client to the new room
		socket.join(roomId);

		//send client room data
		socket.emit('joined room', roomId, rooms[roomId]['members']);

		//echo to room's client that a new member has connected
		socket.broadcast.to(roomId).emit('new user', userName);
	});

	//when the client emits 'chat message'
	socket.on('chat message', function(msg){
		//sends this message to everyone except the client (broadcast)
		socket.broadcast.to(socket.roomId).emit('chat message', '<b>' + socket.userName + ':</b> ' + msg);
  	});

	socket.on('disconnect', function(){
		if (socket.roomId != undefined) {
			var pos = findMember(socket.roomId, socket.userName);
			//removes the member of the room
			rooms[socket.roomId]['members'].splice(pos, 1);
			
			//if the room has at least one member -> broadcast 'user disconnected'; else remove the room
			if (rooms[socket.roomId]['members'].length > 0)
				socket.broadcast.to(socket.roomId).emit('user disconnected', socket.userName, pos);	
			else
				delete(rooms[socket.roomId]);

			socket.leave(socket.roomId);
		}
	});
});


//generates a random alphanumeric string of 'n' length
function randomAlphanumeric(n) {
    var id = '';
    var domain = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i=0; i < n; i++)
        id += domain.charAt(Math.floor(Math.random() * domain.length));

    return id;
}

//find a member of the room X given his userName
function findMember(roomId, userName) { 
	for (var i = 0; i < rooms[roomId]['members'].length; i++) {
		if (rooms[roomId]['members'][i] == userName) 
			return i;	
	}
	return -1;
}