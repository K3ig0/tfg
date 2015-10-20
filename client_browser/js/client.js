 //document ready? ->
$(function() {

//initialize socket.io
var socket = io();

var userName = '';

//<enter> key on the username textbox to access the chat
$('#joinOptions .inputUsername').keyup(function(e) {
    if(e.which == 13) //enter key
        $('#join').click();
});
$('#join').click(function() {
	var userName_input = $('#joinOptions .inputUsername').val();

	//alphanumeric usernames [2-15] length
	if (/^[A-Za-z0-9]{2,15}$/.test(userName_input))
		socket.emit('login', userName_input);
	else
		errorAccessOptions('The username must contain between 2 and 15 alphanumeric characters');
});


socket.on('login', function(data) {
	//server returns false if the username already exists
	if (data != false) {

		//this userName is alphanumeric and nobody picked
		userName = $('#joinOptions .inputUsername').val();

		initChat();
			
		//users online
		for	(i = 0; i < data.length; i++) 
		    $('#users').append($('<li>').text(data[i]));
	}
	else
		errorAccessOptions('This username already exists');
});



//** Functions **/
function errorAccessOptions(str) {
	if ($('#joinOptions p:first').html() == null)
		$('#joinOptions').append($('<p>').text(str));
	else
		$('#joinOptions p:first').html(str);	
}

function initChat() {
	$('#joinOptions').hide();
	$('#chat').show();

	//send a message pressing <Enter>
	$('#inputMsg').bind('enterKey',function(e){
		var msg = $('#inputMsg').val();

		//check no empty messages
		if (msg != null && msg != '') {

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
		$('#users').append($('<li>').text(userName));
	});


	//when a user leaves the chat
	socket.on('user disconnected', function(userName, pos) {
		$('#messages').append($('<li>').html('<i>The user <b>' + userName + '</b> has left</i>'));
		$('#users li').eq(pos).remove();
	});
}
});