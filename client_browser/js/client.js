 //document ready? ->
$(function() {

//initialize socket.io
var socket = io();

var userName = '';


//back button = first screen
window.onpopstate = function(event) {
	location.replace(document.URL);
};

$('#newRoom').click(function() {
	$('#access').hide();
	$('#newOptions').show();
});

$('#joinRoom').click(function() {
	$('#access').hide();
	$('#joinOptions').show();
});


//<enter> key on a textbox to create a room
$('#newOptions .inputUsername, #newOptions .inputRoom').keyup(function(e) {
    if(e.which == 13) //enter key
        $('#new').click();
});
//creating a room
$('#new').click(function() {
	var roomName = $('#newOptions .inputRoom').val();
	userName = $('#newOptions .inputUsername').val();

	//alphanumeric usernames [2-15] length
	if (/^[A-Za-z0-9]{2,15}$/.test(userName)) {
		if (/^[A-Za-z0-9]{2,10}$/.test(roomName))
			socket.emit('new room', userName, roomName);
		else if (roomName == null || roomName == '')
			socket.emit('new room', userName, null);
		else {
			errorAccessOptions('The room name must contain between 2 and 10 alphanumeric characters');
			return;
		}
	} else
		errorAccessOptions('The username must contain between 2 and 15 alphanumeric characters');
});

socket.on('created room', function(roomId){
	//if the roomName is not exists
	if (roomId != false) {
		window.history.pushState('create', 'Room: ' + roomId, '/' + roomId);
		initRoom();
		$('#roomNumber').append($('<u>').text(roomId));
		$('#members').append($('<li>').text(userName));
	}
	else
		errorAccessOptions('This room name already exists');
});


//<enter> key on a textbox to join a room
$('#joinOptions .inputUsername, #joinOptions .inputRoom').keyup(function(e) {
    if(e.which == 13) //enter key
        $('#join').click();
});
//joining a room
$('#join').click(function() {
	var roomName = $('#joinOptions .inputRoom').val();
	userName = $('#joinOptions .inputUsername').val();

	//alphanumeric usernames [2-15] length
	if (/^[A-Za-z0-9]{2,15}$/.test(userName)) {
		if (/^[A-Za-z0-9]{2,10}$/.test(roomName))
			socket.emit('join room', userName, roomName);
		else {
			errorAccessOptions('The room name must contain between 2 and 10 alphanumeric characters');
			return;
		}
	} else
		errorAccessOptions('The username must contain between 2 and 15 alphanumeric characters');
});

socket.on('joined room', function(code, members){
	//if username and roomName are unique -> code = roomId
	if (code != 0 && code != 1) {
		history.pushState('join', 'Room: ' + code, '/' + code);
		initRoom();
		$('#roomNumber').append($('<u>').text(code));
		for	(i = 0; i < members.length; i++) 
	    	$('#members').append($('<li>').text(members[i]));
	}
	else if (code == 0)
		errorAccessOptions('This username already exists');
	else if (code == 1)
		errorAccessOptions('Room not found');
});


$('.cancel').click(function() {
		$('.accessOptions').hide();
		$('.accessOptions input').val('');
		$('.accessOptions p').text('');
		$('#access').show();
});



//** Functions **/
function errorAccessOptions(str) {
	var parent = '#newOptions';
	if ($('#joinOptions').css('display') == 'block')
		parent = '#joinOptions';
	if ($(parent + ' p:first').html() == null)
		$(parent).append($('<p>').text(str));
	else
		$(parent + ' p:first').html(str);	
}

function initRoom() {
	$('.accessOptions').hide();
	$('#chat').show();

	//send a message pressing <Enter>
	$('#inputMsg').bind('enterKey',function(e){
		var msg = $('#inputMsg').val();

		//dont send empty or just spaces messages
		if (jQuery.trim(msg).length != 0) {

	   		//send the event 'chat message' to the server
			socket.emit('chat message', msg);

			//append the message to the list
			$('#messages').append($('<li>').html('<b>' + userName + ':</b> ' + msg));

			//empty the bar to write new messages
			$('#inputMsg').val('');

			//scroll automatically to the written message
			$('#conversation').animate({scrollTop: $('#messages li:last-child').position().top + $('#messages li:last-child').height()});
		}
	});
	$('#inputMsg').keyup(function(e) {
	    if(e.which == 13)
	        $(this).trigger('enterKey');
	});

	//receive chat messages
	socket.on('chat message', function(msg) {	
		$('#messages').append($('<li>').html(msg));
	});


	//when a new user enters the chat
	socket.on('new user', function(userName) {
		$('#messages').append($('<li>').html('<i>The user <b>' + userName + '</b> is connected</i>'));
		$('#members').append($('<li>').text(userName));
	});


	//when a user leaves the chat
	socket.on('user disconnected', function(userName, pos) {
		$('#messages').append($('<li>').html('<i>The user <b>' + userName + '</b> has left</i>'));
		$('#members li').eq(pos).remove();
	});
}
});