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
	var sgUserDefault = {
			id: '',
			username: '',
			role: 'remote',
			color: '',
			idx: null,//the index of this user in the users array
			calibrations: 0,//number of calibrations this user has made
			calibrationAngles: [],//object containing the angles of this user to other users he has calibrated with
			hasCalibrated: false,
			isRef: false,//flag indicating if this device is the room's central point of reference
			position: null,//this user's position {x:0, y:0}
			isPositioned: false,
			angleToGrid: null,//angle to the reference grid
			anglesToOtherUsersOnGrid: [],// array of angles to other users in reference grid's coordinate system
			anglesToOtherUsers: []// array of angles to other users in *this device's* coordinate system, ordered by angle
		},
		sgUser,
		sgDevice = {
			orientation: {}
		},
		sgUsers = [],//array of users, in order of joining
		// sgRefsAngles = [],//array of angles to users relative to ref, in order of direction
		sgAnglesToOtherUsersOnGrid = [],// array of angles to other users in reference grid's coordinate system
		sgAnglesToOtherUsers = [],// array of angles to other users in *this device's* coordinate system, ordered by angle
		// sgPositions = [],//array of every positioned user's position in the reference grid
		sgMaxPointingDeviation = 30,// maximum deviation on either side from the registered angle to a user; you're pointing at a user when you point within (registeredAngle - sgMaxPointingDeviation and registeredAngle + sgMaxPointingDeviation)
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
		$('#id-box').find('.username')
			.text(sgUser.username)
			.end()
			.find('.user-id').text(sgUser.id);
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
		var colors = ['Aqua', 'Aquamarine', 'Black', 'Blue', 'BlueViolet', 'Brown', 'CadetBlue', 'Chartreuse', 'Chocolate', 'Coral', 'CornflowerBlue', 'Crimson', 'DarkBlue', 'DarkCyan', 'DarkGoldenRod', 'DarkGray', 'DarkGreen', 'DarkMagenta', 'DarkOliveGreen', 'DarkOrange', 'DarkOrchid', 'DarkRed', 'DarkSalmon', 'DarkSeaGreen', 'DarkSlateBlue', 'DarkSlateGray', 'DarkTurquoise', 'DarkViolet', 'DeepPink', 'DeepSkyBlue', 'DimGray', 'DodgerBlue', 'FireBrick', 'ForestGreen', 'Fuchsia', 'Gold', 'GoldenRod', 'Gray', 'Green', 'GreenYellow', 'HotPink', 'IndianRed ', 'Indigo ', 'LawnGreen', 'LightBlue', 'LightCoral', 'LightGreen', 'LightPink', 'LightSalmon', 'LightSeaGreen', 'LightSkyBlue', 'LightSlateGray', 'LightSteelBlue', 'Lime', 'LimeGreen', 'Magenta', 'Maroon', 'MediumAquaMarine', 'MediumBlue', 'MediumOrchid', 'MediumPurple', 'MediumSeaGreen', 'MediumSlateBlue', 'MediumTurquoise', 'MediumVioletRed', 'MidnightBlue', 'Navy', 'Olive', 'OliveDrab', 'Orange', 'OrangeRed', 'Orchid', 'PaleVioletRed', 'Peru', 'Pink', 'Plum', 'Purple', 'RebeccaPurple', 'Red', 'RosyBrown', 'RoyalBlue', 'SaddleBrown', 'Salmon', 'SandyBrown', 'SeaGreen', 'Sienna', 'SkyBlue', 'SlateBlue', 'SlateGray', 'SpringGreen', 'SteelBlue', 'Tan', 'Teal', 'Tomato', 'Turquoise', 'Violet', 'YellowGreen'],
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
		if (data.changedUser.id === sgUser.id) {
			//this is the user that was changed
			sgUser = data.changedUser;
			// console.log('update users - I was changed');
		}
	};
	


	/**
	* send an event to the socket server that will be passed on to all sockets
	* @returns {undefined}
	*/
	var emitPassTroughEvent = function(eventName, eventData) {
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
			emitPassTroughEvent('tiltchange', newData);
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
		$('#username').on('focus', function(e) {e.target.select()});
		$('#login-form').on('submit', function(e) {
			e.preventDefault();

			var $form = $(e.currentTarget);
			sgUser.username = $form.find('[name="username"]').val() || sgUser.username;

			displayIdentifier();

			io.emit('join', sgUser);
		});
	};


	/**
	* initialize the login form
	* @returns {undefined}
	*/
	var initLogoutForm = function() {
		$('#logout-form').on('submit', leaveHandler);
	};


	/**
	* 
	* @returns {undefined}
	*/
	var leaveHandler = function(e) {
			if (e) {
				//e is not sent by server on reset passthrough event
				e.preventDefault();
			}

			io.emit('leave', sgUser);

			$('#login-form').show();
			$('#logout-form').hide();
			$('#calibration-box').hide();
	};
	
	

	/**
	* handle socket's acceptance of entry request
	* @param {object} users All users currently in the room
	* @returns {undefined}
	*/
	var joinedHandler = function(users) {
		//this remote has been joined the room
		$('#login-form').hide();
		$('#logout-form').show();
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
	* handle user leaving 
	* @param {object} data {removedUser, users}
	* @returns {undefined}
	*/
	var userLeftHandler = function(data) {
		//console.log('left:', data);
		var removedUser = data.removedUser;
		if (removedUser !== null) {
			//console.log('posaware.js: user ', removedUser.username, 'left');
		}
		sgUsers = data.users;
	};


	/**
	* handle user disconnecting altoghether
	* user leaving room will be handled first by userLeftHandler
	* @param {object} data {removedUser, users}
	* @returns {undefined}
	*/
	var userDisconnectHandler = function(data) {
		//console.log('disconnect:', data);
	};


	/**
	* a new user's position has been calculated
	* @returns {undefined}
	*/
	var updatepositionHandler = function(data) {
		// sgPositions = data.positions;
		// console.log('update pos:', data);
		// console.log(sgPositions);
		// console.log('updatepositionHandler:', data);
		//console.log('new position for user ', data.changedUser.username,':', data.changedUser.position);
		//calculate the angles to all users
		if (sgUser.id === data.changedUser.id) {
			// console.log('I can now be positioned');
			// this user has just become aware of its position
		}

	};


	/**
	* reset
	* @returns {undefined}
	*/
	var resetHandler = function(e) {
		setTimeout(function() {
			document.location.reload();
		}, 200);
	};
	
	
	


	/**
	* add event listeners for socket
	* @param {string} varname Description
	* @returns {undefined}
	*/
	var initSocketListeners = function() {
		io.on('joined', joinedHandler);
		io.on('newuser', newUserHandler);
		io.on('userleft', userLeftHandler);
		io.on('disconnect', userDisconnectHandler);
		io.on('reset', resetHandler);
		io.on('updateusers', updateusersHandler);
		io.on('updateposition', updatepositionHandler);
	};


	/**
	* recalculate angles to change from 0 - 360 range to -180 - 180 
	* @param {number} a The angle to recalculate rotation angle
	* @returns {number} The recalculated angle
	*/
	var rebaseTo180 = function(a) {
		a = a%360;//reduce anything > 360
		if (a > 180) {
			a -= 360;
		} else if (a < -180) {
			a += 360;
		}

		return a;
	};


	/**
	* recalculate angles to change from -180 - 180 range to 0 - 360
	* @param {number} a The angle to recalculate rotation angle
	* @returns {number} The recalculated angle
	*/
	var rebaseTo360 = function(a) {
		a += 360;
		a = a%360;

		return a;
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
	* parse angle in radians to degrees
	* @param {number} radians The angle in radians
	* @returns {number} the angle in degrees
	*/
	var radiansToDegrees = function(radians) {
		var degrees = 360*radians / (2*Math.PI);
		return degrees;
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
		var dummyDeviceAngles = [
			[250],// [ab]
			[320, 240],// [ba, bc]
			[55, 95, 135],// [ca, cb, cd]
			[35, 340, 10],// [da, dc, de]
			[35, 100, 50],// [ea, ed, ef]
			[115, 100, null]// [fa, fe, fg]
		];
		var angle = dummyDeviceAngles[sgUser.idx][sgUser.calibrations];

		// console.log(angle, sgUser.idx, sgUser.calibrations);

		$('#dummy-angle').val(angle);
	};
	
	

	/**
	* show the calibration box
	* @returns {undefined}
	*/
	var showCalibration = function(otherUser) {
		// console.log('showCalibration; user:', sgUser);
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
	* so this user has done a calibration
	* @returns {undefined}
	*/
	var calibrationHandler = function(evt) {

		evt.preventDefault();
		$sgCalibrationBox.hide();

		var angle = sgDevice.orientation.dir;
		if (evt.currentTarget.id === 'dummy-calibration-form') {
			//dummy calibration was used
			angle = $('#dummy-angle').val();
			// console.log('dummy angle:', angle);
		}
		angle = rebaseTo180(angle);// -180/180

		// log('angle:'+angle+'<br>'+otherUserId);

		//store current angle and id of other user
		var	otherUserId = $(evt.currentTarget).find('[name="calibrate-user-id"]').val(),
			currCalibration = {
				fromId: sgUser.id,
				toId: otherUserId,
				angle: angle
			};

		sgUser.calibrationAngles.push(currCalibration);

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
	* initialize the reset button
	* @returns {undefined}
	*/
	var initResetButton = function() {
		$('#reset-btn').on('click', function(e) {
			e.preventDefault;
			io.emit('reset');
		})
	};


	/**
	* create a user object for the current user
	* @returns {undefined}
	*/
	var createCurrentUser = function() {
		sgUser = $.extend({}, sgUserDefault);
		sgUser.id = io.id;
		setUserName();
		displayIdentifier();
		setUserColor();
	};
	
	


	/**
	* initialize the remote
	* @returns {undefined}
	*/
	var initRemote = function() {
		createCurrentUser();
		initSocketListeners();
		initDeviceOrientation();
		initLoginForm();
		initLogoutForm();
		initCalibrationForm();
		initResetButton();
	};


	/**
	* kick off the app once the socket connection is ready
	* @param {event} e The ready.socket event sent by socket js
	* @param {objet} data Data object {io, users}
	* @returns {undefined}
	*/
	var connectionReadyHandler = function(e, data) {
		var io = data.io,
			users = data.users;
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

	// sortAngleArray();


})(jQuery);