 //document ready? ->
$(function() {

//initialize socket.io
var socket = io();

var userName = '';
var initRoom_bool = false; //responsive purpose
var onpopstate = false;

//map variables
var map;
var markers = {};
var markerIcon = L.Icon.extend({
	options: {
		shadowUrl: '../images/marker-shadow.png',
		iconSize: [25, 39], 	// size of the icon
	    shadowSize: [41, 41], 	// size of the shadow
	    iconAnchor:   [12, 36], // point of the icon which will correspond to marker's location
	    shadowAnchor: [12, 38], // the same for the shadow
	    popupAnchor: [0, -30]   // point from which the popup should open relative to the iconAnchor
	}
});

//caching elements we'll use multiple times
var $access = $('#access');
var $map = $('#map');
var $chat = $('#chat');
var $messages = $('#messages');
var $members = $('#members');
var $inputMsg = $('#inputMsg');
var $showMapButton = $('#showMapButton');
var $showChatButton = $('#showChatButton');

//back button = first screen
window.onpopstate = function() {
    if (onpopstate == true)
		location.assign(document.URL);
};

//resize event to adjust automatically according to the window resolution
$(window).on('resize', function(){
	
	//if not mobile device
	if(!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {

		if ($map.css('bottom') == '0px' && initRoom_bool) {
	   		$chat.hide();
	   		$('#switchButtons').css('display','inline');
			$map.show();
			$showMapButton.css('font-weight', 'bold');
			$showChatButton.css('font-weight', 'normal');
		}
		else if (initRoom_bool) {
			$('#switchButtons').hide();
			$map.show();
			$chat.show();
		}
	}
});

//check the uri and try to join the room id contained in the uri
joinUriId();


//receive from server the event 'public rooms'
socket.on('public rooms', function(rooms){
	$('#publicRooms p').hide();

	for (var r = 0; r < rooms.length; r++) 
		$('#publicRooms ul').append($('<li>').html('Room id: <a href=/'+rooms[r]+'>'+rooms[r]+'</a>'));
});

socket.on('remove public room', function(pos){
	$('#publicRooms ul li').eq(pos).remove();

	if ($('#publicRooms ul li:first').html() == null)
		$('#publicRooms p').show();
});


$('#newRoom').click(function() {
	$('#access, #publicRooms').hide();
	$('#newOptions').show();
});

$('#joinRoom').click(function() {
	$('#access, #publicRooms').hide();
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
			socket.emit('new room', userName, roomName, $('#newOptions select').val());
		else if (roomName == null || roomName == '')
			socket.emit('new room', userName, null, $('#newOptions select').val());
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
		history.pushState('create', 'Room: ' + roomId, '/' + roomId);
		onpopstate = true;
		initRoom();
		$('#roomNumber').append($('<u>').text(roomId));
		$members.append($('<li>').text(userName));
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
		onpopstate = true;
		initRoom(members);
		$('#roomNumber').append($('<u>').text(code));
		for	(i = 0; i < members.length; i++) 
	    	$members.append($('<li>').text(members[i].userName));
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
	$('#access, #publicRooms').show();
});


//SHOW CHAT BUTTON (only mobile and tablet)
$showChatButton.click(function(){
	$map.hide();
	$chat.show();
	$showChatButton.css('font-weight', 'bold');
	$showMapButton.css('font-weight', 'normal');
});

//SHOW MAP BUTTON (only mobile and tablet)
$showMapButton.click(function(){
	$chat.hide();
	$map.show();
	$showMapButton.css('font-weight', 'bold');
	$showChatButton.css('font-weight', 'normal');
});


//** Functions **/
function joinUriId() {
	var url = document.URL;
	var pos = url.lastIndexOf('/');

	//id from the uri, example: localhost:8988/a1b23 ([2-10] characters, checked previously in server)
	var id = url.substring(pos + 1);

    if (id != '') {
    	$('#joinOptions .inputRoom').val(id);
		$('#joinOptions').show();
    	$('#joinOptions .inputUsername').focus();
	}
	else {
		$access.css('display', 'table');
		$('#publicRooms').show();
	}
}

function errorAccessOptions(str) {
	var parent = '#newOptions';
	if ($('#joinOptions').css('display') == 'block')
		parent = '#joinOptions';
	if ($(parent + ' p:first').html() == null)
		$(parent).append($('<p>').text(str));
	else
		$(parent + ' p:first').html(str);	
}

function initRoom(members) {
	initRoom_bool = true;
	$('.accessOptions').hide();
	$map.show();

	// if the device is mobile or tablet -->
	if ($map.css('bottom') == '0px')
		//show the switch button to alternate map/chat view
    	$('#switchButtons').css('display','inline');
    	
	else
		$chat.show();

	prepareMap();
	geolocation();

	if (members != undefined) //dont do this after create a room
		updateMarkers(members);

	//send a message pressing <Enter>
	$inputMsg.bind('enterKey',function(e){
		var msg = $inputMsg.val();

		//dont send empty or just spaces messages
		if (jQuery.trim(msg).length != 0) {

	   		//send the event 'chat message' to the server
			socket.emit('chat message', msg);

			//append the message to the list
			$messages.append($('<li>').html('<b>' + userName + ':</b> ' + msg));

			//empty the bar to write new messages
			$inputMsg.val('');

			//scroll automatically to the written message
			$('#conversation').animate({scrollTop: $('#messages li:last-child').position().top + $('#messages li:last-child').height()});
		}
	});
	$inputMsg.keyup(function(e) {
	    if(e.which == 13)
	        $(this).trigger('enterKey');
	});

	//receive chat messages
	socket.on('chat message', function(msg) {	
		$messages.append($('<li>').html(msg));
	});


	//when a new user enters the chat
	socket.on('new user', function(userName) {
		$messages.append($('<li>').html('<i>The user <b>' + userName + '</b> is connected</i>'));
		$members.append($('<li>').text(userName));
	});


	//when a user leaves the chat
	socket.on('user disconnected', function(userName, pos) {
		//if the user disconnected has not a marker defined then has not been geolocated
		if (markers[userName] != undefined) {
			map.removeLayer(markers[userName].marker);
			map.removeLayer(markers[userName].circle);
			delete markers[userName];
		}
		$messages.append($('<li>').html('<i>The user <b>' + userName + '</b> has left</i>'));
		$('#members li').eq(pos).remove();
	});

	//when we receive member coords from the server
	socket.on('member coords', function(members) {
		updateMarkers(members);
	});
}

function prepareMap() {
	map = L.map('map');
	L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
		    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(map);
}

function updateMarkers(members) {
	for (i = 0; i < members.length; i++) {
		if (members[i].coords != undefined) {
			var marker, circle, radius = members[i].coords.acc / 2;

			//if the user has a marker defined in the map
			if (markers[members[i].userName] != undefined) {
				markers[members[i].userName].marker.setLatLng(members[i].coords.latlng);
				markers[members[i].userName].marker.setPopupContent('<b>' + members[i].userName + '</b><br>is within ' + radius.toFixed() + ' meters from this point');
				markers[members[i].userName].circle.setLatLng(members[i].coords.latlng);
				markers[members[i].userName].circle.setRadius(radius);
	    	}

	    	else {
				marker = L.marker(members[i].coords.latlng, {title: members[i].userName, icon: new markerIcon({iconUrl: '../images/marker-yellow.png'}), opacity: 0.9}).addTo(map);
		    	marker.bindPopup('<b>' + members[i].userName + '</b><br>is within ' + radius.toFixed() + ' meters from this point');
				circle = L.circle(members[i].coords.latlng, radius, {color: 'yellow'}).addTo(map);
		    	markers[members[i].userName] = {marker: marker, circle: circle};
	    	}
    	}
	}
}

function geolocation() {
	var setView = true;
	var highAccuracy = true;

	map.locate({watch: true, enableHighAccuracy: true, timeout: 5000});

	//if the geolocation worked ->
	map.on('locationfound', function onLocationFound(e){

		//only apply the zoom one time!
		if (setView == true) {
			setView = false;
			map.setView(e.latlng, 16);
		}

		var radius = (e.accuracy / 2).toFixed();

	   //if my marker is defined (my marker is the position: zero) ->
	   if (markers[0] != undefined) {
			markers[0].marker.setLatLng(e.latlng);
			markers[0].marker.setPopupContent('You are within ' + radius + ' meters from this point');
			markers[0].circle.setLatLng(e.latlng);
			markers[0].circle.setRadius(radius);
    	}
	    else {
	    	markers[0] = {marker: L.marker(e.latlng, {title: 'My location', riseOnHover: true, icon: new markerIcon({iconUrl: '../images/marker-blue.png'})}), circle: L.circle(e.latlng, radius)};
	    	markers[0].marker.addTo(map).bindPopup('You are within ' + radius + ' meters from this point').openPopup();
	    	markers[0].circle.addTo(map);
	    }

		socket.emit('coords', {latlng: e.latlng, acc: e.accuracy});
	});

	//if the geolocation failed ->
	map.on('locationerror', function onLocationError(e){			
		//error codes: http://dev.w3.org/geo/api/spec-source.html#code

		//PERMISSION_DENIED = 1;
		if (e.code == 1) 
			popUpMapError('The location acquisition process failed because the application does not have permission to use the Geolocation API. Please share your location enabling the "Location" option on your device.');

		//POSITION_UNAVAILABLE = 2;
		else if (e.code == 2) 
			popUpMapError('The position of the device could not be determined.');

		//TIMEOUT = 3;
		//trying not high accuracy geolocation
		else if (e.code == 3 && highAccuracy == true) {
			highAccuracy = false;

			//default: (enableHighAccuracy: false)
			map.locate({watch: true, timeout: 10000});
		}
		else if (e.code == 3 && highAccuracy == false) 
			popUpMapError('Exceeded the timeout to find your location. Maybe you need share your location enabling the "Location" option on your device.');

		//unknown error
		else 
			popUpMapError(e.message);
	});
}

function popUpMapError(msg) {
	map.fitWorld();	
	msg += '<p>We recommend the use of a device that can access GPS satellites, Wi-Fi networks, and mobile networks.</p><p>We also recommend you use the latest stable version of browsers: Chrome, Firefox or Opera.</p>'
	L.popup().setLatLng([0, 0]).setContent(msg).openOn(map);
}
});
