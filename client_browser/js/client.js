//document ready? ->
$(function() {

//initialize socket.io
var socket = io();

var userName = '';
var fullScreen_bool;
var initRoom_bool = false;
var onpopstate = false;

//map variables
var map, last_position, fitWorld = false;
var markers = {};
var markerIcon = L.Icon.extend({
    options: {
        shadowUrl: '../images/shadow-marker.png',
        iconSize:     [25, 39],  // size of the icon
        shadowSize:   [41, 41],  // size of the shadow
        iconAnchor:   [12, 36],  // point of the icon which will correspond to marker's location
        shadowAnchor: [12, 38],  // the same for the shadow
        popupAnchor:  [0, -30]   // point from which the popup should open relative to the iconAnchor
    }
});

//meeting points
var dest_marker, mostVoted;
var limit_dests = 0;
var suggested_meetings = {group: new L.featureGroup([])};
var dragIcon = L.Icon.extend({
    options: {iconSize: [34, 45], iconAnchor: [15, 40], popupAnchor: [0, -30]}
});

var destIcon = L.Icon.extend({
    options: {iconSize: [35, 42], iconAnchor: [18, 40], popupAnchor: [0, -30]}
});

var mostVotedIcon = L.Icon.extend({
    options: {iconSize: [49, 58], iconAnchor: [25, 55], popupAnchor: [0, -30]}
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
    //if low window resolution
    if ($map.css('bottom') == '0px' && initRoom_bool) {
        if (!/Mobi/.test(navigator.userAgent) || $chat.css('display') == 'none' || fullScreen_bool) {
            fullScreen_bool = false;
            $chat.hide();
            $('#switchButtons').css('display','inline');
            $map.show();
            $showMapButton.css('font-weight', 'bold');
            $showChatButton.css('font-weight', 'normal');
        }
    }
    else if (initRoom_bool) {
        fullScreen_bool = true;
        $('#switchButtons').hide();
        $map.show();
        $chat.show();
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
    $(this).prop("disabled", true); 
    var roomName = $('#newOptions .inputRoom').val();
    userName = $('#newOptions .inputUsername').val();

    //alphanumeric usernames [2-15] length
    if (/^[A-Za-z0-9]{2,15}$/.test(userName)) {
        if (/^[A-Za-z0-9]{2,10}$/.test(roomName))
            socket.compress(false).emit('new room', userName, roomName, $('#newOptions select').val());
        else if (roomName == null || roomName == '')
            socket.compress(false).emit('new room', userName, null, $('#newOptions select').val());
        else 
            errorAccessOptions('The room name must contain between 2 and 10 alphanumeric characters', '#new');
    } else
        errorAccessOptions('The username must contain between 2 and 15 alphanumeric characters', '#new');
});

socket.on('created room', function(roomId){
    //if the roomName is not exists
    if (roomId != false) {
        //support HTML5 - History
        if (window.history && window.history.pushState) {
            history.pushState('create', 'Room: ' + roomId, '/' + roomId);
            onpopstate = true;
        }
        initRoom();
        $('#roomNumber').text(roomId);
        $members.append($('<li>').text(userName));
    }
    else
        errorAccessOptions('This room name already exists', '#new');
});


//<enter> key on a textbox to join a room
$('#joinOptions .inputUsername, #joinOptions .inputRoom').keyup(function(e) {
    if(e.which == 13) //enter key
        $('#join').click();
});
//joining a room
$('#join').click(function() {
    $(this).prop("disabled", true);
    var roomName = $('#joinOptions .inputRoom').val();
    userName = $('#joinOptions .inputUsername').val();

    //alphanumeric usernames [2-15] length
    if (/^[A-Za-z0-9]{2,15}$/.test(userName)) {
        if (/^[A-Za-z0-9]{2,10}$/.test(roomName))
            socket.compress(false).emit('join room', userName, roomName);
        else
            errorAccessOptions('The room name must contain between 2 and 10 alphanumeric characters', '#join');
    } else
        errorAccessOptions('The username must contain between 2 and 15 alphanumeric characters', '#join');
});

socket.on('joined room', function(code, members, meeting_points){
    //if username and roomName are unique -> code = roomId
    if (code != 0 && code != 1) {
        //support HTML5 - History
        if (window.history && window.history.pushState) {
            history.pushState('join', 'Room: ' + code, '/' + code);
            onpopstate = true;
        }
        initRoom(members, meeting_points);
        $('#roomNumber').text(code);
        for (i = 0; i < members.length; i++) 
            $members.append($('<li>').text(members[i].userName));
    }
    else if (code == 0)
        errorAccessOptions('This username already exists', '#join');
    else if (code == 1)
        errorAccessOptions('Room not found', '#join');
});


$('.cancel').click(function() {
    var url = document.URL;
    var pos = url.lastIndexOf('/');
    var id = url.substring(pos + 1);
    if (id != '')
        //support HTML5 - History
        if (window.history && window.history.replaceState)
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


function errorAccessOptions(str, caller) {
    var parent = '#newOptions';
    $(caller).prop("disabled", false);
    if (caller.localeCompare('#join') == 0)
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
        var highVoted = {votes: 0};
        for (var m = 0; m < meeting_points.length; m++) {
            addMeetingPoint(meeting_points[m].userName, 
                meeting_points[m].latlng, meeting_points[m].votes);
            if (meeting_points[m].votes > highVoted.votes)
                highVoted = {latlng: meeting_points[m].latlng, votes: meeting_points[m].votes};
        }
        if (highVoted.latlng != undefined)
            newMostVotedMeeting(highVoted.latlng.lat, highVoted.latlng.lng);
    }

    //send a message pressing <Enter>
    $inputMsg.bind('enterKey',function(e){
        var msg = $inputMsg.val();

        //dont send empty or just spaces messages
        if (jQuery.trim(msg).length != 0) {

               //send the event 'chat message' to the server
            socket.compress(false).emit('chat message', msg);

            //append the message to the list
            $messages.append($('<li>').html('<b>' + userName + ':</b> ' + msg));

            //empty the bar to write new messages
            $inputMsg.val('');

            //scroll automatically to the written message
            if ($('#conversation').height <= $messages.height)
                $('#conversation').prop({scrollTop: $messages.height()});
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
        checkMostVotedMeeting(latlng.lat, latlng.lng);
        $messages.append($('<li>').html('<i><b>' + userName + '</b> has <b>suggested</b> a meeting point: <a class="dest_coords" href="#[' + latlng.lat + ',' + latlng.lng + ']"> ['+latlng.lat.toFixed(4)+', '+latlng.lng.toFixed(4)+']</i>'));
    });
    socket.on('remove suggested point', function(userName, latlng, mostVotedReceived){
        map.removeLayer(suggested_meetings[latlng.lat+latlng.lng]);
        suggested_meetings.group.removeLayer(suggested_meetings[latlng.lat+latlng.lng]);
        delete suggested_meetings[latlng.lat+latlng.lng];
        if (mostVotedReceived != undefined) {
            suggested_meetings[mostVotedReceived].setIcon(new mostVotedIcon({iconUrl: '../images/green-home.png'}));
            mostVoted = mostVotedReceived;
        }
        else if (latlng.lat+latlng.lng == mostVoted)
            mostVoted = undefined;
        $messages.append($('<li>').html('<i><b>' + userName + '</b> has <b>removed</b> the meeting point: <a class="dest_coords" href="#[' + latlng.lat + ',' + latlng.lng + ']"> ['+latlng.lat.toFixed(4)+', '+latlng.lng.toFixed(4)+']</i>'));        
    });

    //receiving voted meeting points
    socket.on('vote meeting point', function(userName, latlng){
        suggested_meetings[latlng.lat+latlng.lng].setPopupContent(updateVote(suggested_meetings[latlng.lat+latlng.lng].getPopup().getContent(), 1));
        suggested_meetings[latlng.lat+latlng.lng].votes++;
        suggested_meetings[latlng.lat+latlng.lng].fire('popupopen');
        $messages.append($('<li>').html('<i><b>' + userName + '</b> has <b>voted</b> the meeting point: <a class="dest_coords" href="#[' + latlng.lat + ',' + latlng.lng + ']"> ['+latlng.lat.toFixed(4)+', '+latlng.lng.toFixed(4)+']</i>'));
        checkMostVotedMeeting(latlng.lat, latlng.lng);
    });
    socket.on('unvote meeting point', function(userName, latlng){
        suggested_meetings[latlng.lat+latlng.lng].setPopupContent(updateVote(suggested_meetings[latlng.lat+latlng.lng].getPopup().getContent(), -1));
        suggested_meetings[latlng.lat+latlng.lng].votes--;
        suggested_meetings[latlng.lat+latlng.lng].fire('popupopen');
        $messages.append($('<li>').html('<i><b>' + userName + '</b> has <b>unvoted</b> the meeting point: <a class="dest_coords" href="#[' + latlng.lat + ',' + latlng.lng + ']"> ['+latlng.lat.toFixed(4)+', '+latlng.lng.toFixed(4)+']</i>'));
        if (latlng.lat+latlng.lng == mostVoted)
            findMostVotedMeeting();
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
        return false;
    });
}


function prepareMap() {
    var osm_tileLayer = L.tileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://cartodb.com/attributions">CartoDB</a>'
    });

    var cartoDB_tileLayer = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://cartodb.com/attributions">CartoDB</a>'
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
                        stateName: 'default',
                        onClick: function(){
                            if (markers[0] != undefined)
                                map.setView(markers[0].marker.getLatLng(), 16);
                            else
                                L.popup().setLatLng(map.getCenter()).setContent('You must share your location to use this feature.').openOn(map);
                        },
                        title: 'Focus on my position',
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
                        stateName: 'default',
                        onClick: function(){
                            var allMarkers = [];
                            $('#members').find('li').each(function() {
                                if ($(this).text() != userName && markers[$(this).text()] != undefined)
                                    allMarkers.push(markers[$(this).text()].marker);
                                else if (markers[0] != undefined)
                                    allMarkers.push(markers[0].marker)
                            });
                            if (allMarkers[0] != undefined) {
                                var group = new L.featureGroup(allMarkers);
                                map.fitBounds(group.getBounds());
                            }
                            else
                                L.popup().setLatLng(map.getCenter()).setContent('No members connected or have not shared their location.').openOn(map);
                        },
                        title: 'Focus on all members',
                        icon: 'fa-users fa-lg'
                    }]
                });

                 var meetingsBtn = L.easyButton({
                    id: 'focusMeetings',       // an id for the generated button
                    position: 'topleft',      // inherited from L.Control -- the corner it goes in
                    type: 'replace',          // set to animate when you're comfy with css
                    leafletClasses: true,     // use leaflet classes to style the button?
                    states:[{                 // specify different icons and responses for your button
                        stateName: 'default',
                        onClick: function(){
                            if (suggested_meetings.group.getBounds().isValid())
                                map.fitBounds(suggested_meetings.group.getBounds());
                            else
                                L.popup().setLatLng(map.getCenter()).setContent('No suggested meeting points.').openOn(map);
                        },
                        title: 'Focus on suggested meetings',
                        icon: '<span class="fa-stack">'+
                                '<i class="fa fa-globe fa-stack-2x"></i>'+
                                '<i class="fa fa-crosshairs fa-lg"></i></span>'
                    }]
                });

                var markerBtn = L.easyButton({
                    id: 'suggestMeetingPoint', // an id for the generated button
                    position: 'topleft',       // inherited from L.Control -- the corner it goes in
                    type: 'replace',           // set to animate when you're comfy with css
                    leafletClasses: true,      // use leaflet classes to style the button?
                    states:[{                  // specify different icons and responses for your button
                        stateName: 'default',
                        onClick: function(){
                            var center = map.getCenter();
                            if (dest_marker == undefined && limit_dests < 5) {
                                dest_marker = new L.marker([center.lat-0.0001, center.lng], {draggable:'true', icon: new dragIcon({iconUrl: '../images/drag-marker.png'})})
                                    .on('popupopen',onPopupOpen).addTo(map).bindPopup('Drag and drop the marker to the location you want and click on it to suggest a meeting point.').openPopup();
                                dest_marker.on('dragend', function(event) {
                                    dest_marker = event.target;
                                    var position = dest_marker.getLatLng();
                                    dest_marker.setLatLng(new L.LatLng(position.lat, position.lng)).bindPopup('Is this the meeting point you want to suggest to the other members?<p><button class="marker-location-yes">Suggest!</button></p>Delete without suggesting?<p><button class="mymarker-delete-yes">Yes</button><button class="marker-no">No</button></p>');
                                    map.panTo(new L.LatLng(position.lat, position.lng))
                                });
                            } 
                            else if (dest_marker != undefined)
                                L.popup().setLatLng(dest_marker.getLatLng()).setContent('Set up this meeting point before attempting to create a new one.').openOn(map);
                            else 
                                L.popup().setLatLng(center).setContent('You have suggested five meeting points.<br>Please click one to delete it before suggest a new meeting point.').openOn(map);
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
                        stateName: 'default',
                        onClick: function(){
                            map.toggleFullscreen();
                        },
                        title: 'Full Screen',
                        icon: 'fa-arrows-alt fa-lg'
                    }]
                });

                targetBar = L.easyBar([userBtn, usersBtn, meetingsBtn]);
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
    var tempVotes = 0;

    if (votes == undefined)
        tempVotes = 1;
    else
        tempVotes = votes;

    suggested_meetings[latlng.lat+latlng.lng] = new L.marker(latlng, {title: 'Meeting point suggested by ' + userName, icon: new destIcon({iconUrl: '../images/yellow-home.png'})})
                .on('popupopen',onPopupOpen).addTo(map).bindPopup('<b>'+userName+'</b>'+' has suggested this meeting point.<p>Votes: '+tempVotes+'<br>Do you want to vote it?</p><p><button class="marker-vote">Vote!</button></p>');
    suggested_meetings[latlng.lat+latlng.lng].votes = tempVotes;
    suggested_meetings.group.addLayer(suggested_meetings[latlng.lat+latlng.lng]);
}


function geolocation() {
    var geolocated = false;
    var setView = true;
    var highAccuracy = true;
    var geolocatingLoader = initialLoader();    

    map.locate({watch: true, enableHighAccuracy: true, timeout: 10000});

    //if the geolocation worked ->
    map.on('locationfound', function onLocationFound(e){

        //quit the message 'Attempting to find your location...'
        if (geolocated == false) {
            geolocated = true;
            geolocatingLoader.removeFrom(map);
        }

        var radius = (e.accuracy / 2).toFixed();
        var accuracyLimit = 500;

        //checking accuracy
        if (radius < accuracyLimit) {

            //only apply the zoom one time!
            if (setView == true) {
                setView = false;
                map.setView(e.latlng, 16);
            }

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
                socket.compress(false).emit('coords', {latlng: e.latlng, acc: e.accuracy});
                last_position = e.latlng;
            }
        }
        else //not accuracy
            popUpMapError('Exceeded the limit of accuracy ('+accuracyLimit+'m). Your location can not be achieved accurately.')
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
function popUpMapError(msg, only) {
    msg += '<p>We recommend using a device that can access GPS satellites, Wi-Fi networks, and mobile networks. However you are free to use most of the features. Close this dialogue to start.</p>'+
            '<p>Works best with Chrome, Firefox, Opera or Edge.</p>';

    //users didnt have shared their locations
    if (fitWorld == false) {
        map.fitWorld();
        L.popup().setLatLng(map.getCenter()).setContent(msg).openOn(map);
        fitWorld = true;
    }
}


//Function to handle events of opened marker popups
function onPopupOpen() {
    var tempMarker = this;

    $('.marker-location-yes:visible').click(function () {
        var latlng = tempMarker.getLatLng();
        socket.compress(false).emit('suggested point', latlng);
        map.removeLayer(tempMarker);
        suggested_meetings[latlng.lat+latlng.lng] = new L.marker(latlng, {icon: new destIcon({iconUrl: '../images/blue-home.png'})})
                .on('popupopen',onPopupOpen).addTo(map).bindPopup('Votes: 1</span><br>Do you want to vote/unvote this meeting point?<p><button class="marker-vote">Unvote!</button></p>Delete the suggested meeting point?<p><button class="marker-delete-yes">Yes</button><button class="marker-no">No</button></p>');
        suggested_meetings[latlng.lat+latlng.lng].unvoted = true;
        suggested_meetings[latlng.lat+latlng.lng].votes = 1;
        suggested_meetings[latlng.lat+latlng.lng].owner = userName;
        checkMostVotedMeeting(latlng.lat,latlng.lng);
        suggested_meetings.group.addLayer(suggested_meetings[latlng.lat+latlng.lng]);
        limit_dests++;
        dest_marker = undefined;
    });

    $('.marker-delete-yes:visible').click(function () {
        var latlng = tempMarker.getLatLng();
        map.removeLayer(tempMarker);
        suggested_meetings.group.removeLayer(tempMarker);
        limit_dests--;

        //if the removed meeting is not the most voted
        if (mostVoted != latlng.lat+latlng.lng)
            socket.compress(false).emit('remove suggested point', latlng);
        else { //find the most voted meeting and send it and the removed
            var found = findMostVotedMeeting();
            if (found != undefined) {
                socket.compress(false).emit('remove suggested point', latlng, found.lat+found.lng);
                newMostVotedMeeting(found.lat, found.lng);
            }
            else {
                socket.compress(false).emit('remove suggested point', latlng);
                mostVoted = undefined;
            }
        }
        delete suggested_meetings[latlng.lat+latlng.lng];
    });

    //delete before set up the meeting point
    $('.mymarker-delete-yes:visible').click(function () {
        map.removeLayer(tempMarker);
        dest_marker = undefined;
    });

    $('.marker-no:visible').click(function () {
        tempMarker.closePopup();
    });

    $('.marker-vote:visible').click(function () {
        var latlng = tempMarker.getLatLng();

        if (suggested_meetings[latlng.lat+latlng.lng].unvoted) {
            socket.compress(false).emit('unvote meeting point', latlng);
            suggested_meetings[latlng.lat+latlng.lng].unvoted = false;
            suggested_meetings[latlng.lat+latlng.lng].votes--;
            tempMarker.setPopupContent(updateVote(tempMarker.getPopup().getContent(), -1).
                replace(/Vote!|Unvote!/,function(match) {return (match=="Vote!")?"Unvote!":"Vote!";}));
            tempMarker.fire('popupopen');
            if (latlng.lat+latlng.lng == mostVoted)
                findMostVotedMeeting();
        }
        else {
            socket.compress(false).emit('vote meeting point', latlng);
            suggested_meetings[latlng.lat+latlng.lng].unvoted = true;
            suggested_meetings[latlng.lat+latlng.lng].votes++;
            tempMarker.setPopupContent(updateVote(tempMarker.getPopup().getContent(), 1).
                replace(/Vote!|Unvote!/,function(match) {return (match=="Vote!")?"Unvote!":"Vote!";}));
            tempMarker.fire('popupopen');
            checkMostVotedMeeting(latlng.lat, latlng.lng);
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


function checkMostVotedMeeting(lat, lng) {
    if (mostVoted == undefined)
        newMostVotedMeeting(lat, lng);

    else if (suggested_meetings[mostVoted].votes < suggested_meetings[lat+lng].votes) {
        if (suggested_meetings[mostVoted].owner == userName)
            suggested_meetings[mostVoted].setIcon(new destIcon({iconUrl: '../images/blue-home.png'}));
        else
            suggested_meetings[mostVoted].setIcon(new destIcon({iconUrl: '../images/yellow-home.png'}));
        newMostVotedMeeting(lat, lng);
    }
}


function newMostVotedMeeting(lat, lng) {
    suggested_meetings[lat+lng].setIcon(new mostVotedIcon({iconUrl: '../images/green-home.png'}));
    mostVoted = lat+lng;
}


function findMostVotedMeeting() {
    var array = suggested_meetings.group.getLayers();
    var highVoted = {votes: 0};

    for (var i = 0; i < array.length; i++) {
        if (array[i].votes > highVoted.votes || highVoted.latlng == undefined) 
            highVoted = {latlng: array[i].getLatLng(), votes: array[i].votes};
    }
    if (highVoted.latlng != undefined)
        checkMostVotedMeeting(highVoted.latlng.lat, highVoted.latlng.lng);

    return highVoted.latlng;
}
});
