var express = require('express'),
    app = express(),
    http = require('http').Server(app),
    io = require('socket.io')(http),
    port = 8988,

    rooms = [],
    publicRooms = [];


//express.static is a middleware to serve files
app.use('/', express.static(__dirname + '/client_browser'));

//join room directly from a link
app.get('/[A-Za-z0-9]{2,10}$', function(req, res) {
    res.sendFile(__dirname + '/client_browser/index.html');
});

//server listening port
http.listen(port, function () {
  console.log('Server listening goes on localhost listening at port: %s', port);
});


//handling events
io.on('connection', function(socket){

    //join initial room
    socket.join(0);

    //list of public rooms is sent to the user, <public rooms> event
    if (publicRooms.length > 0)
        socket.emit('public rooms', publicRooms);

    //*** NEW ROOM ***
    //when a client emits 'new room'
    socket.on('new room', function(userName, roomName, exposure){
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

        //leave initial room
        socket.leave(0);

        //store the username in the socket session for this client
        socket.userName = userName;

        //store the room name in the socket session for this client
        socket.roomId = roomId;

        //add the room info to the global list
        rooms[roomId] = {
            members: [{userName: userName, coords: undefined}],
            exposure: exposure,
            meeting_points: []
        };

        //send client to the new room
        socket.join(roomId);

        //send client his room id
        socket.emit('created room', roomId);

        //if the room will be public
        if (exposure == 0) {
            //add the room id generated to the public list
            publicRooms.push(roomId);

            //echo to everyone that a new public room has been created
            socket.broadcast.to(0).emit('public rooms', [roomId]);
        }
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

        //leave initial room
        socket.leave(0);

        //store the username in the socket session for this client
        socket.userName = userName;

        //store the room name in the socket session for this client
        socket.roomId = roomId;

        //add the user to the list of members of the room in the rooms global list
        rooms[roomId]['members'].push({userName: userName, coords: undefined});

        //send client to the new room
        socket.join(roomId);

        //send client room data
        socket.emit('joined room', roomId, rooms[roomId]['members'], rooms[roomId]['meeting_points']);

        //echo to room's client that a new member has connected
        socket.broadcast.to(roomId).emit('new user', userName);
    });


    //*** COORDS EXCHANGE (geolocation) ***
    //when a client (member) emits 'coords'
    socket.on('coords', function(coords){
        //this client is a member?
        if (socket.roomId != undefined) {
            //Debug
            console.log('User: %s --> lat: %s / lng: %s / acc: %s', socket.userName, coords.latlng.lat, coords.latlng.lng, coords.acc);
            
            //send the client name and coords to the members of his room
            socket.broadcast.to(socket.roomId).emit('member coords', [{userName: socket.userName, coords: coords}]);

            //store my coords in the members list
            rooms[socket.roomId]['members'][findMember(socket.roomId, socket.userName)].coords = coords;
        }
    });


    //*** CHAT MESSAGE ***
    //when the client emits 'chat message'
    socket.on('chat message', function(msg){
        //sends this message to everyone except the client (broadcast)
        socket.broadcast.to(socket.roomId).emit('chat message', '<b>' + socket.userName + ':</b> ' + msg);
      });


    //*** SUGGESTED MEETING POINT MARKERS ***
    //when a member send a suggested meeting point to his room
    socket.on('suggested point', function(latlng){
        socket.broadcast.to(socket.roomId).emit('suggested point', socket.userName, latlng);

        //store the meeting point received in the room data
        rooms[socket.roomId]['meeting_points'].push({userName: socket.userName, latlng: latlng, votes: 1});
    });

    socket.on('remove suggested point', function(latlng){
        socket.broadcast.to(socket.roomId).emit('remove suggested point', socket.userName, latlng);

        //removes the meeting point in the room data
        rooms[socket.roomId]['meeting_points'].splice(findMeetingPoint(socket.roomId, latlng), 1);
    });


    //*** VOTING MEETING POINTS ***
    socket.on('vote meeting point', function(latlng){
        socket.broadcast.to(socket.roomId).emit('vote meeting point', socket.userName, latlng);

        //store the vote received in the associated meeting point
        rooms[socket.roomId]['meeting_points'][findMeetingPoint(socket.roomId, latlng)].votes++;
    });

    socket.on('unvote meeting point', function(latlng){
        socket.broadcast.to(socket.roomId).emit('unvote meeting point', socket.userName, latlng);

        //store the vote received in the associated meeting point
        rooms[socket.roomId]['meeting_points'][findMeetingPoint(socket.roomId, latlng)].votes--;
    });


    //*** AUTO DISCONNECTION handling ***
    //when the clients close the web application
    socket.on('disconnect', function(){
        if (socket.roomId != undefined) {
            var pos = findMember(socket.roomId, socket.userName);

            //removes the member of the room
            rooms[socket.roomId]['members'].splice(pos, 1);
            
            //if the room has at least one member -> broadcast 'user disconnected'; else remove the room
            if (rooms[socket.roomId]['members'].length > 0)
                socket.broadcast.to(socket.roomId).emit('user disconnected', socket.userName, pos);    
            else {
                if (rooms[socket.roomId]['exposure'] == 0) {
                    var roomPublicPos = publicRooms.indexOf(socket.roomId);
                    publicRooms.splice(roomPublicPos, 1);
                    io.emit('remove public room', roomPublicPos);
                }
                delete(rooms[socket.roomId]);
            }
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
        if (rooms[roomId]['members'][i].userName == userName) 
            return i;    
    }
    return -1;
}


//find a member of the room X given his userName
function findMeetingPoint(roomId, latlng) { 
    for (var i = 0; i < rooms[roomId]['meeting_points'].length; i++) {
        if (rooms[roomId]['meeting_points'][i].latlng.lat == latlng.lat
            && rooms[roomId]['meeting_points'][i].latlng.lng == latlng.lng)
            return i;    
    }
    return -1;
}