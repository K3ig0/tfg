 //document ready? ->
$(function() {

//initialize socket.io
var socket = io();

var userName = '';
var initRoom_bool = false;
var onpopstate = false;

//map variables
var map, last_position;
var markers = {};
var markerIcon = L.Icon.extend({
    options: {
        shadowUrl: '../images/shadow-marker.png',
        iconSize: [25, 39],     // size of the icon
        shadowSize: [41, 41],   // size of the shadow
        iconAnchor:   [12, 36], // point of the icon which will correspond to marker's location
        shadowAnchor: [12, 38], // the same for the shadow
        popupAnchor: [0, -30]   // point from which the popup should open relative to the iconAnchor
    }
});

//suggesting meeting points
var dest_marker;
var limit_dests = 0;
var suggested_meetings = {};
var dragIcon = L.Icon.extend({
    options: {
        iconSize: [34, 45],     // size of the icon
        iconAnchor:   [12, 36], // point of the icon which will correspond to marker's location
        popupAnchor: [0, -30]   // point from which the popup should open relative to the iconAnchor
    }
});

var destIcon = L.Icon.extend({
    options: {
        iconSize: [35, 42],     // size of the icon
        iconAnchor:   [12, 36], // point of the icon which will correspond to marker's location
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
    var url = document.URL;
    var pos = url.lastIndexOf('/');
    var id = url.substring(pos + 1);
    if (onpopstate == true) {
        location.assign(url);
        if (id != '')
            history.replaceState('', 'init', '/');
    }
};

//resize event to adjust automatically according to the window resolution (only for testing in desktop computers)
$(window).on('resize', function(){
    
    //if not mobile device (this pattern is a recommendation of Mozilla)
    if(!/Mobi/.test(navigator.userAgent)) {

        //if low window resolution
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

socket.on('joined room', function(code, members, meeting_points){
    //if username and roomName are unique -> code = roomId
    if (code != 0 && code != 1) {
        history.pushState('join', 'Room: ' + code, '/' + code);
        onpopstate = true;
        initRoom(members, meeting_points);
        $('#roomNumber').append($('<u>').text(code));
        for    (i = 0; i < members.length; i++) 
            $members.append($('<li>').text(members[i].userName));
    }
    else if (code == 0)
        errorAccessOptions('This username already exists');
    else if (code == 1)
        errorAccessOptions('Room not found');
});


$('.cancel').click(function() {
    var url = document.URL;
    var pos = url.lastIndexOf('/');
    var id = url.substring(pos + 1);
    if (id != '')
        history.replaceState('', 'init', '/');

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
        $(parent).prepend($('<p>').text(str));
    else
        $(parent + ' p:first').html(str);    
}


function initRoom(members, meeting_points) {
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

    if (members != undefined) //dont do this if the function was called from create a room
        updateMarkers(members);

    if (meeting_points != undefined) { //dont do this if the function was called from create a room
        for (var m = 0; m < meeting_points.length; m++){
            addMeetingPoint(meeting_points[m].userName, 
                meeting_points[m].latlng, meeting_points[m].votes);
        }
    }

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


    //when we receive 'member coords' from the server
    socket.on('member coords', function(members) {
        updateMarkers(members);
    });


    //receiving a meeting point suggested by a member
    socket.on('suggested point', function(userName, latlng){
        addMeetingPoint(userName, latlng);
        $messages.append($('<li>').html('<i><b>' + userName + '</b> has <b>suggested</b> a meeting point: <a class="dest_coords" href="#[' + latlng.lat + ',' + latlng.lng + ']"> ['+latlng.lat.toFixed(4)+', '+latlng.lng.toFixed(4)+']</i>'));
    });

    socket.on('remove suggested point', function(userName, latlng){
        map.removeLayer(suggested_meetings[latlng.lat+latlng.lng]);
        delete suggested_meetings[latlng.lat+latlng.lng];
        $messages.append($('<li>').html('<i><b>' + userName + '</b> has <b>removed</b> the meeting point: <a class="dest_coords" href="#[' + latlng.lat + ',' + latlng.lng + ']"> ['+latlng.lat.toFixed(4)+', '+latlng.lng.toFixed(4)+']</i>'));
    });

    //click here (chat message) to go the suggested meeting point (event delegation, is not present at the time DOM ready)
    $(document).on('click', '.dest_coords', function(){

        // example: coords = [40.23134106086199,-7.89183105016199]
        var coords = $(this).attr('href');
        var lat = coords.substring(2,coords.indexOf(','));
        var lng = coords.substring(coords.indexOf(',')+1,coords.indexOf(']'));
        // if the device is mobile or tablet -->
        if ($map.css('bottom') == '0px') {
            $chat.hide();
            $map.show();
        }

        map.panTo(new L.LatLng(lat, lng));
        //suggested_meetings[lat+lng].openPopup();
        return false;
    });


    //receiving voted meeting points
    socket.on('vote meeting point', function(userName, latlng){
        suggested_meetings[latlng.lat+latlng.lng].setPopupContent(updateVote(suggested_meetings[latlng.lat+latlng.lng].getPopup().getContent(), 1));
        suggested_meetings[latlng.lat+latlng.lng].fire('popupopen');
        $messages.append($('<li>').html('<i><b>' + userName + '</b> has <b>voted</b> the meeting point: <a class="dest_coords" href="#[' + latlng.lat + ',' + latlng.lng + ']"> ['+latlng.lat.toFixed(4)+', '+latlng.lng.toFixed(4)+']</i>'));
    });
    socket.on('unvote meeting point', function(userName, latlng){
        suggested_meetings[latlng.lat+latlng.lng].setPopupContent(updateVote(suggested_meetings[latlng.lat+latlng.lng].getPopup().getContent(), -1));
        suggested_meetings[latlng.lat+latlng.lng].fire('popupopen');
        $messages.append($('<li>').html('<i><b>' + userName + '</b> has <b>unvoted</b> the meeting point: <a class="dest_coords" href="#[' + latlng.lat + ',' + latlng.lng + ']"> ['+latlng.lat.toFixed(4)+', '+latlng.lng.toFixed(4)+']</i>'));
    });
}


function prepareMap() {
    var osm_tileLayer = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    });

    var cartoDB_tileLayer = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    });

    map = L.map('map', {zoomControl: false});
    map.addLayer(osm_tileLayer);

    //map tiles loader
    var loadingControl = L.Control.loading({position: 'topright'});
    map.addControl(loadingControl);

    //custom buttons
    var menuBar, targetBar;
    var showOptions = L.easyButton({
        states: [{
            stateName: 'add-options',
            icon: 'fa-bars fa-lg',
            title: 'Show menu',
            onClick: function(control) {

                //focus on my marker
                var userBtn = L.easyButton({
                    id: 'myPosition',         // an id for the generated button
                    position: 'topleft',      // inherited from L.Control -- the corner it goes in
                    type: 'replace',          // set to animate when you're comfy with css
                    leafletClasses: true,     // use leaflet classes to style the button?
                    states:[{                 // specify different icons and responses for your button
                        stateName: 'get-myposition',
                        onClick: function(){
                            if (markers[0] != undefined)
                                map.setView(markers[0].marker.getLatLng(), 16);
                        },
                        title: 'Focus on my marker',
                        icon: 'fa-user fa-lg'
                    }]
                });

                //focus on room markers
                var usersBtn = L.easyButton({
                    id: 'membersPosition',    // an id for the generated button
                    position: 'topleft',      // inherited from L.Control -- the corner it goes in
                    type: 'replace',          // set to animate when you're comfy with css
                    leafletClasses: true,     // use leaflet classes to style the button?
                    states:[{                 // specify different icons and responses for your button
                        stateName: 'get-positionMembers',
                        onClick: function(){
                            if (markers[0] != undefined) {
                                var allMarkers = [];
                                $('#members').find('li').each(function() {
                                    if ($(this).text() != userName && markers[$(this).text()] != undefined)
                                        allMarkers.push(markers[$(this).text()].marker);
                                    else
                                        allMarkers.push(markers[0].marker)
                                });
                                var group = new L.featureGroup(allMarkers);
                                map.fitBounds(group.getBounds());
                            }
                        },
                        title: 'Focus on all markers',
                        icon: 'fa-users fa-lg'
                    }]
                });

                var markerBtn = L.easyButton({
                    id: 'suggestMeetingPoint', // an id for the generated button
                    position: 'topleft',       // inherited from L.Control -- the corner it goes in
                    type: 'replace',           // set to animate when you're comfy with css
                    leafletClasses: true,      // use leaflet classes to style the button?
                    states:[{                  // specify different icons and responses for your button
                        stateName: 'initial',
                        onClick: function(){
                            if (markers[0] != undefined) {
                                var latlng = markers[0].marker.getLatLng();

                                if (dest_marker == undefined && limit_dests < 5) {
                                    dest_marker = new L.marker([latlng.lat+0.001,latlng.lng], {draggable:'true', icon: new dragIcon({iconUrl: '../images/drag-marker.png'})})
                                        .on('popupopen',onPopupOpen).addTo(map).bindPopup('Drag and drop the marker to the location you want and click on it to suggest a meeting point.').openPopup();
                                    dest_marker.on('dragend', function(event) {
                                        dest_marker = event.target;
                                        var position = dest_marker.getLatLng();
                                        dest_marker.setLatLng(new L.LatLng(position.lat, position.lng)).bindPopup('Is this the meeting point you want to suggest to the other members?<p><button class="marker-location-yes">Yes</button><button class="marker-no">No</button></p>');
                                        map.panTo(new L.LatLng(position.lat, position.lng))
                                    });
                                }
                                else if (dest_marker != undefined)
                                    L.popup().setLatLng(dest_marker.getLatLng()).setContent('Set up this meeting point before attempting to create a new one.').openOn(map);
                                else 
                                    L.popup().setLatLng(markers[0].marker.getLatLng()).setContent('You have suggested five meeting points.<br>Please click one to delete it before suggest a new meeting point.').openOn(map);
                            }
                        },
                        title: 'Suggest a meeting point',
                        icon: 'fa-map-marker fa-lg'
                    }]
                });

                var mapBtn = L.easyButton({
                    id: 'changeMapTileProvider', // an id for the generated button
                    position: 'topleft',         // inherited from L.Control -- the corner it goes in
                    type: 'replace',             // set to animate when you're comfy with css
                    leafletClasses: true,        // use leaflet classes to style the button?
                    states:[{                    // specify different icons and responses for your button
                        stateName: 'default',
                        onClick: function(){
                            if (map.hasLayer(osm_tileLayer)) {
                                map.removeLayer(osm_tileLayer);
                                map.addLayer(cartoDB_tileLayer);
                            }
                            else {
                                map.removeLayer(cartoDB_tileLayer);
                                map.addLayer(osm_tileLayer);
                            }
                        },
                        title: 'Change map tile provider',
                        icon: 'fa-map-o fa-lg'
                    }]
                });

                var fullBtn = L.easyButton({
                    id: 'fullScreen',         // an id for the generated button
                    position: 'topleft',      // inherited from L.Control -- the corner it goes in
                    type: 'replace',          // set to animate when you're comfy with css
                    leafletClasses: true,     // use leaflet classes to style the button?
                    states:[{                 // specify different icons and responses for your button
                        stateName: 'fullScreen',
                        onClick: function(){
                            map.toggleFullscreen();
                        },
                        title: 'Full Screen',
                        icon: 'fa-arrows-alt fa-lg'
                    }]
                });

                targetBar = L.easyBar([userBtn, usersBtn]);
                targetBar.addTo(map);
                $('#myPosition').parent().addClass('target-bar');

                menuBar = L.easyBar([markerBtn, mapBtn, fullBtn]);
                menuBar.addTo(map);

                control.state('hide-options');
            }
        }, {
            stateName: 'hide-options',
            icon: 'fa-undo fa-lg',
            title: 'Hide menu',
            onClick: function(control) {
                targetBar.disable();
                menuBar.disable();
                control.state('show-options');
            }
        }, {
            stateName: 'show-options',
            icon: 'fa-bars fa-lg',
            title: 'Show menu',
            onClick: function(control) {
                targetBar.enable();
                menuBar.enable();
                control.state('hide-options');
            }
        }]
    });
    showOptions.addTo(map);
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
                marker = L.marker(members[i].coords.latlng, {title: members[i].userName, icon: new markerIcon({iconUrl: '../images/yellow-marker.png'}), opacity: 0.9}).addTo(map);
                marker.bindPopup('<b>' + members[i].userName + '</b><br>is within ' + radius.toFixed() + ' meters from this point');
                circle = L.circle(members[i].coords.latlng, radius, {color: 'yellow'}).addTo(map);
                markers[members[i].userName] = {marker: marker, circle: circle};
            }
        }
    }
}


function addMeetingPoint(userName, latlng, votes) {
    var tempVotes;

    if (votes == undefined)
        tempVotes = 1;
    else
        tempVotes = votes;

    suggested_meetings[latlng.lat+latlng.lng] = new L.marker(latlng, {title: 'Meeting point suggested by ' + userName, icon: new destIcon({iconUrl: '../images/yellow-home.png'})})
                .on('popupopen',onPopupOpen).addTo(map).bindPopup('<b>'+userName+'</b>'+' has suggested this meeting point.<p>Votes: '+tempVotes+'<br>Do you want to vote it?</p><p><button class="marker-vote">Vote!</button></p>');
}


function geolocation() {
    var geolocated = false;
    var setView = true;
    var highAccuracy = true;
    var geolocatingLoader = initialLoader();    

    map.locate({watch: true, enableHighAccuracy: true, timeout: 10000});

    //if the geolocation worked ->
    map.on('locationfound', function onLocationFound(e){
        //only apply the zoom one time!
        if (setView == true) {
            setView = false;
            map.setView(e.latlng, 16);
        }
        if (geolocated == false) {
            geolocated = true;
            geolocatingLoader.removeFrom(map);
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
            markers[0] = {marker: L.marker(e.latlng, {title: 'My location', riseOnHover: true, icon: new markerIcon({iconUrl: '../images/blue-marker.png'})}), circle: L.circle(e.latlng, radius)};
            markers[0].marker.addTo(map).bindPopup('You are within ' + radius + ' meters from this point').openPopup();
            markers[0].circle.addTo(map);
        }

        //avoid share the same last location
        if (last_position == undefined || last_position.lat != e.latlng.lat || last_position.lng != e.latlng.lng) {
            socket.emit('coords', {latlng: e.latlng, acc: e.accuracy});
            last_position = e.latlng;
        }
    });

    //if the geolocation failed ->
    map.on('locationerror', function onLocationError(e) {
        if (geolocated == false) {
            geolocated = true;
            geolocatingLoader.removeFrom(map);
        }

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


//Show the message: Attempting to find your location
function initialLoader() {
    var geolocatingLoader = L.control({position: 'topright'});

    geolocatingLoader.onAdd = function() {
        var div = L.DomUtil.create('div', 'geolocating');
        div.innerHTML = 'Attempting to find your location...';
        return div;
    };
    geolocatingLoader.addTo(map);

    return geolocatingLoader;
}


//Prompt an error message and advise the user
function popUpMapError(msg) {
    map.fitWorld();    
    msg += '<p>We recommend the use of a device that can access GPS satellites, Wi-Fi networks, and mobile networks.</p><p>Works best in Chrome</p>'
    L.popup().setLatLng([0, 0]).setContent(msg).openOn(map);
}


//Function to handle events of opened marker popups
function onPopupOpen() {
    var tempMarker = this;

    $('.marker-location-yes:visible').click(function () {
        var latlng = tempMarker.getLatLng();
        socket.emit('suggested point', latlng);
        map.removeLayer(tempMarker);
        suggested_meetings[latlng.lat+latlng.lng] = new L.marker(latlng, {icon: new destIcon({iconUrl: '../images/blue-home.png'})})
            .on('popupopen',onPopupOpen).addTo(map).bindPopup('Votes: 1</span><br>Do you want to vote/unvote this meeting point?<p><button class="marker-vote">Unvote!</button></p>Delete the suggested meeting point?<p><button class="marker-delete-yes">Yes</button><button class="marker-no">No</button></p>');
        suggested_meetings[latlng.lat+latlng.lng].unvoted = true;
        limit_dests++;
        dest_marker = undefined;
    });

    $('.marker-delete-yes:visible').click(function () {
        limit_dests--;
        map.removeLayer(tempMarker);
        socket.emit('remove suggested point', tempMarker.getLatLng());
    });

    $('.marker-no:visible').click(function () {
        tempMarker.closePopup();
    });

    $('.marker-vote:visible').click(function () {
        var latlng = tempMarker.getLatLng();

        if (suggested_meetings[latlng.lat+latlng.lng].unvoted) {
            socket.emit('unvote meeting point', latlng);
            suggested_meetings[latlng.lat+latlng.lng].unvoted = false;
            tempMarker.setPopupContent(updateVote(tempMarker.getPopup().getContent(), -1).
                replace(/Vote!|Unvote!/,function(match) {return (match=="Vote!")?"Unvote!":"Vote!";}));
            tempMarker.fire('popupopen');
        }
        else {
            socket.emit('vote meeting point', latlng);
            suggested_meetings[latlng.lat+latlng.lng].unvoted = true;
            tempMarker.setPopupContent(updateVote(tempMarker.getPopup().getContent(), 1).
                replace(/Vote!|Unvote!/,function(match) {return (match=="Vote!")?"Unvote!":"Vote!";}));
            tempMarker.fire('popupopen');
        }
    });
}

function updateVote(content, vote) {
    var res = content.replace(/Votes: (\d+)/, function(match, number) {
        var votes = parseInt(number)+vote;
        return 'Votes: ' + votes;
    });
    return res;
}
});
