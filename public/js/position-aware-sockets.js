;(function($) {

	'use strict';

	/* global io */ //instruction for jshint

	//globals:
	//window.io is defined by socket.IO.
	//It represents the socket server.
	//io is a bit of a strange name, but it's being used in examples everywhere,
	//so let's stick to that.


	// define semi-global variables (vars that are "global" in this file's scope) and prefix them
	// with sg so we can easily distinguish them from "normal" vars
	var sgUser = {
			id: '',
			username: '',
			role: 'remote',
			color: '',
			idx: 0,//the index of this user in the users array
			hasJoined: false,
			calibrations: 0,//number of calibrations this user has made
			hasCalibrated: false,
			isRef: false,//flag indicating if this device is the room's central point of reference
			directionToRef: null,//this user's angle to the ref
			position: {x:0, y:0},//this user's position
			angles: []//object containing the angles of this user to other users
		},
		sgDevice = {
			orientation: {},
			compassCorrection: 0,
			referenceCorrection: 0
		},
		sgUsers = [],//array of users, in order of joining
		sgRefsAngles = [],//array of angles to users relative to ref, in order of direction
		sgPositions = [],
		sgReferenceLength = 100;// reference length for position calculations; this is the length between idx0 and idx1

	var $sgCalibrationBox = $('#calibration-box');

	

	/**
	* log to screen
	* @returns {undefined}
	*/
	var log = function(msg) {
		$('#logwin').html(msg);
	};
	

	/**
	* add identifier for this user
	* @returns {undefined}
	*/
	var displayIdentifier = function() {
		$('#id-box').find('.user-id').text(sgUser.username+' '+sgUser.id);
	};

	/**
	* return the latest user in the users array
	* @returns {object} The user object of the latest user who joined
	*/
	var getLatestUser = function() {
		return sgUsers[sgUsers.length-1];
	};


	/**
	* get a user from the users-array by their id
	* @param {string} id The id of the user to find
	* @returns {object} the searched for user object or false
	*/
	var getUserById = function(id) {
		var user;
		for (var i=0, len=sgUsers.length; i<len; i++) {
			if (sgUsers[i].id === id) {
				user = sgUsers[i];
				break;
			}
		}
		return user;
	};
	


	/**
	* set a dummy username
	* @returns {undefined}
	*/
	var setUserName = function() {
		var names = ['annie', 'bep', 'clara', 'dirk', 'edje', 'fred', 'gerrit', 'henk', 'jan', 'kees', 'marie', 'neeltje', 'piet','truus', 'wim'],
			nm = names[Math.floor(names.length*Math.random())]+Math.ceil(99*Math.random());
		sgUser.username = nm;
		$('input[name="username"]').val(nm);
	};
	

	/**
	* set an identifying color for this user
	* @returns {undefined}
	*/
	var setUserColor = function() {
		var colors = ['Aqua', 'Aquamarine', 'Black', 'Blue', 'BlueViolet', 'Brown', 'CadetBlue', 'Chartreuse', 'Chocolate', 'Coral', 'CornflowerBlue', 'Crimson', 'DarkBlue', 'DarkCyan', 'DarkGoldenRod', 'DarkGray', 'DarkGreen', 'DarkMagenta', 'DarkOliveGreen', 'DarkOrange', 'DarkOrchid', 'DarkRed', 'DarkSalmon', 'DarkSeaGreen', 'DarkSlateBlue', 'DarkSlateGray', 'DarkTurquoise', 'DarkViolet', 'DeepPink', 'DeepSkyBlue', 'DimGray', 'DodgerBlue', 'FireBrick', 'ForestGreen', 'Fuchsia', 'Gold', 'GoldenRod', 'Gray', 'Green', 'GreenYellow', 'HotPink', 'IndianRed ', 'Indigo ', 'LawnGreen', 'LightBlue', 'LightCoral', 'LightGreen', 'LightPink', 'LightSalmon', 'LightSeaGreen', 'LightSkyBlue', 'LightSlateGray', 'LightSteelBlue', 'Lime', 'LimeGreen', 'Magenta', 'Maroon', 'MediumAquaMarine', 'MediumBlue', 'MediumOrchid', 'MediumPurple', 'MediumSeaGreen', 'MediumSlateBlue', 'MediumTurquoise', 'MediumVioletRed', 'MidnightBlue', 'Navy', 'Olive', 'OliveDrab', 'Orange', 'OrangeRed', 'Orchid', 'PaleVioletRed', 'Peru', 'Pink', 'Plum', 'Purple', 'RebeccaPurple', 'Red', 'RosyBrown', 'RoyalBlue', 'SaddleBrown', 'Salmon', 'SandyBrown', 'SeaGreen', 'Sienna', 'SkyBlue', 'SlateBlue', 'SlateGray', 'SpringGreen', 'SteelBlue', 'Tan', 'Teal', 'Tomato', 'Turquoise', 'Violet', 'Yellow', 'YellowGreen'],
			len = colors.length;

		sgUser.color = colors[Math.floor(len*Math.random())];

		$('.user-color').css('background', sgUser.color);
	};


	/**
	* handle update of users array
	* @param {object} data Object containing updated users array and the updated user {users, changedUser}
	* @returns {undefined}
	*/
	var updateusersHandler = function(data) {
		sgUsers = data.users;
		//console.log('update users; changed: idx'+data.changedUser.idx);
	};
	


	/**
	* change a property of the current user and send changed users object to server
	* server stores the changed users object and sends object to sockets
	* @returns {undefined}
	*/
	/*
	var updateUser = function(prop, val) {
		sgUser[prop] = val;
		for (var i=0, len=sgUsers.length; i<len; i++) {
			var currUser = sgUsers[i];
			if (currUser.id === sgUser.id) {
				sgUsers[i] = sgUser;
				break;
			}
		}

		var data = {
			users: sgUsers,
			changedUser: sgUser
		}
		io.emit('updateusers', data);
	};
	*/
	


	/**
	* send an event to the socket server that will be passed on to all sockets
	* @returns {undefined}
	*/
	var emitEvent = function(eventName, eventData) {
		var data = {
			eventName: eventName,
			eventData: eventData
		};
		io.emit('passthrough', data);
	};


	/**
	* when remote is tilted, send orientation data and this device's id to the socket
	* @param {event} e The tiltchange.deviceorientation event sent by device-orientation.js
	* @param {object} data Data sent accompanying the event
	* @returns {undefined}
	*/
	var tiltChangeHandler = function(e, data) {

		var tiltLR = Math.round(data.tiltLR),
			tiltFB = Math.round(data.tiltFB),
			dir = Math.round(data.dir);

		dir -= sgDevice.compassCorrection;

		if (sgDevice.orientation.tiltLR !== tiltLR || sgDevice.orientation.tiltFB !== tiltFB || sgDevice.orientation.dir !== dir) {
			sgDevice.orientation = {
				tiltLR: tiltLR,
				tiltFB: tiltFB,
				dir: dir
			};

			var newData = {
				id: io.id,
				orientation: sgDevice.orientation
			};
			emitEvent('tiltchange', newData);
		}
	};


	/**
	* initialize stuff for handling device orientation changes
	* listen for events triggered on body by device-orientation.js
	* @returns {undefined}
	*/
	var initDeviceOrientation = function() {
		sgDevice.orientation = {
			tiltLR: 0,
			tiltFB: 0,
			dir: 0
		};

		$('body').on('tiltchange.deviceorientation', tiltChangeHandler);
	};



	/**
	* initialize the login form
	* @returns {undefined}
	*/
	var initLoginForm = function() {
		$('#login-form').on('submit', function(e) {
			e.preventDefault();

			var $form = $(e.currentTarget);
			sgUser.username = $form.find('[name="username"]').val() || sgUser.username;

			joinRoom();
		});
	};
	

	/**
	* handle socket's acceptance of entry request
	* @param {object} users All users currently in the room
	* @returns {undefined}
	*/
	var joinedHandler = function(users) {
		//this remote has been joined the room
		$('#login-form').hide();
		sgUsers = users;
		sgUser = getLatestUser();

		//set up listener for when another user has calibrated; only needs to be picked up by ref, but subscribe all in case ref leaves the room
		// io.on('calibrationready.positionawaresockets', calibrationreadyHandler);
		//set up listener for when a new calibration can start
		//io.on('calibrationpossible.positionawaresockets', calibrationpossibleHandler);
		//set up listener for calibration events, so we know when it's this user's turn
		//io.on('calibrationupdate.positionawaresockets', calibrationupdateHandler);
		//set up listener for calibration events, so we know when it's this user's turn
		io.on('nextcalibration', nextcalibrationHandler);
	};


	/**
	* handle entry of new user in the room
	* @param {object} data Info about the joining user
	* @returns {undefined}
	*/
	var newUserHandler = function(users) {
		sgUsers = users;
	};


	/**
	* handle user disconnecting 
	* @returns {undefined}
	*/
	var userDisconnectHandler = function() {
		
	};


	/**
	* a new user's position has been calculated
	* @returns {undefined}
	*/
	var updatepositionHandler = function(data) {
		sgPositions = data.positions;
		console.log('new position for user ', data.changedUser.username,':', data.changedUser.position);
		//calculate the angles to all users
	};
	
	


	/**
	* add event listeners for socket
	* @param {string} varname Description
	* @returns {undefined}
	*/
	var initSocketListeners = function() {
		io.on('joined', joinedHandler);
		io.on('newuser', newUserHandler);
		io.on('disconnect', userDisconnectHandler);
		io.on('updateusers', updateusersHandler);
		io.on('updateposition', updatepositionHandler);
	};


	/**
	* send event to server to request entry to room
	* @returns {undefined}
	*/
	var joinRoom = function() {
		io.emit('join', sgUser);
	};


	/**
	* parse angle in degrees to radians
	* @param {number} degrees The angle in degrees
	* @returns {number} the angle in radians
	*/
	var degreesToRadians = function(degrees) {
		var radians = 2*Math.PI * degrees/360;
		return radians;
	};
	

	/**
	* a new calibration can be done; see if it's meant for this user
	* @returns {undefined}
	*/
	var nextcalibrationHandler = function(data) {
		//console.log('next:', data.id, sgUser.id);
		if (data.id === sgUser.id) {
			showCalibration(data.otherUser);
		}
	};


	/**
	* prefill the dummy angle field
	* @returns {undefined}
	*/
	var setDummyAngle = function() {
		var dummyAngles = [
			[320],// [ab]
			[250, 310],// [ba, bc]
			[90, 40, 125],// [ca, cb, cd]
			[58, 328, null]// [da, dc, de]
		];

		var angle = dummyAngles[sgUser.idx][sgUser.calibrations];

		console.log(angle, sgUser.idx, sgUser.calibrations);

		$('#dummy-angle').val(angle);
	};
	
	

	/**
	* show the calibration box
	* @returns {undefined}
	*/
	var showCalibration = function(otherUser) {
		$sgCalibrationBox.find('.calibrate-user-name')
				.text(otherUser.username)
			.end()
			.find('input[name="calibrate-user-id"]')
				.val(otherUser.id)
			.end()
			.show();

		setDummyAngle();
	};//showCalibration


	/**
	* handle clicking calibration button
	* so a user has done a calibration
	* @returns {undefined}
	*/
	var calibrationHandler = function(e) {
		e.preventDefault();
		$sgCalibrationBox.hide();

		//store current direction and id of other user
		sgDevice.compassCorrection = sgDevice.orientation.dir;
		var dir = sgDevice.orientation.dir,
			otherUserId = $(e.currentTarget).find('[name="calibrate-user-id"]').val(),
			currCalibration = {
				fromId: sgUser.id,
				toId: otherUserId,
				dir: dir
			};

		log('dir:'+sgDevice.orientation.dir+'<br>'+otherUserId);

		var $form = $();
		if (e.currentTarget.id === 'dummy-calibration-form') {
			//dummy calibration was used
			currCalibration.dir = $('#dummy-angle').val();
		}

		sgUser.angles.push(currCalibration);

		//update number of calibrations and see if we're done for this user
		sgUser.calibrations++;

		//send data back to server
		io.emit('newcalibration', sgUser);
	};


	/**
	* initialize the calibration form
	* @returns {undefined}
	*/
	var initCalibrationForm = function() {
		$('#calibration-form').on('submit', calibrationHandler);
		$('#dummy-calibration-form').on('submit', calibrationHandler);
	};


	/**
	* initialize the remote
	* @returns {undefined}
	*/
	var initRemote = function() {
		sgUser.id = io.id;
		setUserName();
		displayIdentifier();
		setUserColor();
		initSocketListeners();
		initDeviceOrientation();
		initLoginForm();
		initCalibrationForm();
	};


	/**
	* kick off the app once the socket connection is ready
	* @param {event} e The ready.socket event sent by socket js
	* @param {Socket} socket This client's socket
	* @returns {undefined}
	*/
	var connectionReadyHandler = function(e, io) {
		if (io) {
			initRemote();
		}
	};
	
	
	/**
	* initialize the app
	* (or rather: set a listener for the socket to be ready, the handler will initialize the app)
	* @returns {undefined}
	*/
	var init = function() {
		$(document).on('connectionready.socket', connectionReadyHandler);
	};

	$(document).ready(init);


})(jQuery);