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
			isHub: false,//flag indicating if this device is the room's central hub / point of reference
			directionToHub: null,//this user's angle to the hub
			positions: [],//object containing al user's positions in the coordinate system
			directions: []//object containing the directions of this user to other users
		},
		sgDevice = {
			orientation: {},
			compassCorrection: 0,
			referenceCorrection: 0
		},
		sgUsers = [],//array of users, in order of joining
		sgCalibratedUsers = [],
		sgHubsDirections = [],//array of directions to users relative to hub, in order of direction
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
		var names = ['jan','piet','kees','klaas','fred','koos','wim','truus','trees','bep','jannie','clara'],
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
		console.log('update users; changed: idx'+data.changedUser.idx);
	};
	


	/**
	* change a property of the current user and send changed users object to server
	* server stores the changed users object and sends object to sockets
	* @returns {undefined}
	*/
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
		console.log(users);
		sgUsers = users;

		var idx = sgUsers.length-1;
		sgUser.idx = idx;

		if (idx === 0) {
			//this is the first device
			sgUser.isHub = true;
			//console.log('you are the first to join');
		} else {
			var usernames = [];
			for (var i=0, len=users.length-1; i<len; i++) {
			 	usernames.push(users[i].username);
			}
			usernames = usernames.join(', ');
		}

		//set up listener for when another user has calibrated; only needs to be picked up by hub, but subscribe all in case hub leaves the room
		io.on('calibrationready.positionawaresockets', calibrationreadyHandler);
		//set up listener for when a new calibration can start
		io.on('calibrationpossible.positionawaresockets', calibrationpossibleHandler);
		//set up listener for calibration events, so we know when it's this user's turn
		io.on('calibrationupdate.positionawaresockets', calibrationupdateHandler);

		//console.log('number of users:', sgUsers.length);
		nextCalibration();
	};


	/**
	* handle entry of new user in the room
	* @param {object} data Info about the joining user
	* @returns {undefined}
	*/
	var newUserHandler = function(users) {
		sgUsers = users;

		var newUser = getLatestUser();
		//the users array may be passed aroud, so set latest user's idx properly (otherwise it will only be set by latest user's joinedHandler)
		getLatestUser()['idx'] = sgUsers.length-1;
		//console.log('new user '+newUser.username+' has just joined');
		//The first who joins (idx0) has to do calibration when the 2nd user joins
		//idx1 has to do new calibration when idx2 joins, if he already calibrated with idx0
		if ( (sgUser.isHub && sgUsers.length === 2) || (sgUser.idx === 1 && sgUser.directions.length === 1) ) {
			showCalibration();
		}
	};


	/**
	* handle user disconnecting 
	* @returns {undefined}
	*/
	var userDisconnectHandler = function() {
		
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
	* calculate a user's position within the hub's coordinate system
	* this function will only be called on the hub
	* @param {user object} user The user whose position to calculate
	* @returns {undefined}
	*/
	var calculatePosition = function(user) {
		var pos = {};
		if (user.idx === 0) {
			pos = {x:0, y:0};
		} else if (user.idx === 1) {
			//put on default reference length
			pos = {x: 0, y: sgReferenceLength};
		} else {
			// for sake of this calculation:
			// call idx0 node A, idx1 node B and the user we want to calculate node C.
			// see the image in docs/calculations.png

			//calculate angles alpha, beta and gamma
			//TODO: account for cases where angles ba or cb are smaller than bc
			var nodeB = sgUsers[1],
				ba = nodeB.directions[0].dir,//angle from B to A
				bc = nodeB.directions[1].dir,//angle from B to C
				beta = ba - bc;

			var nodeC = user,
				ca = nodeC.directions[0].dir,//angle from C to A
				cb = nodeC.directions[1].dir,//angle from C to B
				gamma = ca - cb;

			beta = 60;
			gamma = 40;

			var alpha = 180 - beta - gamma,
				alphaRadians = degreesToRadians(alpha);

			var AB = sgReferenceLength,
				phi = 90 - beta,
				mu = alpha - phi,
				AC = AB*Math.cos(degreesToRadians(phi)) / Math.cos(degreesToRadians(mu));

			var x = AC*Math.sin(alphaRadians),
				y = AC*Math.cos(alphaRadians);

			console.log(x,y);


		}
	};
	




	/**
	* show the calibration box
	* @returns {undefined}
	*/
	var showCalibration = function() {
		console.log('show');
		if (!sgUser.hasCalibrated) {
			var idx = sgUser.idx,
				calibs = sgUser.calibrations,
				otherUser,
				otherIdx = 0;//default: everyone but idx0 has to do first calibration with idx0

			//determine which user to point to
			if (idx === 0) {
				otherIdx = 1;
			} else if (calibs === 1) {
				if (idx === 1) {
					//second user to calibrate with is the next user
					otherIdx = idx+1;
				} else {
					//second user to calibrate with is the previous user
					otherIdx = idx-1;
				}
			}
			otherUser = sgUsers[otherIdx];

			//show calibration box if the other user has already joined (this may not be the case with only 2 users)
			if (otherUser) {
				$sgCalibrationBox.find('.calibrate-user-name')
						.text(otherUser.username)
					.end()
					.find('input[name="calibrate-user-id"]')
						.val(otherUser.id)
					.end()
					.show();
			} else {
				console.log('no other user yet');
			}
		}
	};//showCalibration


	/**
	* check which user has to calibrate (if any) and show calibration box
	* @returns {undefined}
	*/
	var nextCalibration = function() {
		//console.log(sgUsers.length);
		//console.log(sgUsers);
		var done = true;

		for (var i=0, len=sgUsers.length; i<len; i++) {
			console.log('nextCalibration', i);
			var user = sgUsers[i];
			//console.log('check idx'+user.idx+' cal:'+user.hasCalibrated);
			if (user.hasCalibrated) {
				//continue
				if (user.id === sgUser.id) {console.log('my position is known')}
			} else {
				//we found the first joining user who hasn't calibrated yet
				//check to see if it is us
				done = false;
				console.log('aan de beurt: idx'+i, user);
				if (user.id === sgUser.id) {
					console.log('my position isnt known');
					//then this user has to calibrate
					showCalibration();
				}
				break;
			}
		}
		if (done) {
			console.log('we\'re done calibrating');
		}
	};
	


	/**
	* a calibration has been added
	* @returns {undefined}
	*/
	var calibrationupdateHandler = function(directions) {
		nextCalibration();
	};


	/**
	* a new calibration can be started
	* @returns {undefined}
	*/
	var calibrationpossibleHandler = function() {
		//console.log('calibrationpossibleHandler');
		nextCalibration();
	};
	


	/**
	* another user has done his calibration
	* if we're the hub, update the directions array and send event
	* @param {array} userDirections Object containing other user's id and directions to hub and another user: [{fromId, toId, dir},{fromId, toId, dir}]
	* @returns {undefined}
	*/
	var calibrationreadyHandler = function(userDirections) {
		console.log('calibrationreadyHandler', userDirections);
		if (sgUser.isHub) {
			//we only want the hub to do something
			var senderId = userDirections[0].fromId,
				sender = getUserById(senderId);

			if (sender.isHub) {
				//we're the hub receiving our own calibration; this is the angle towards idx1
				//the axis idx0 - idx1 will be our 0-degrees reference angle
				//so we have to determine the hub's correction-angle
				sgDevice.referenceCorrection = userDirections[0].dir;
			} else if (sender.idx === 1) {
				//then we can store his stuff, and we can put him in the reference position (0, 100)
				console.log('idx1 to reference position');

			} else {
				//we can calculate the sending user's position in hub's coordinate system
				console.log('calculate idx'+sender.idx+' position');
			}
			// console.log('go emit calposible');

			//now calculate the sender's position
			calculatePosition(sender);

			emitEvent('calibrationpossible.positionawaresockets');

		} else {
			//no code here, we only want the hub to do something
		}
	};
	


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
		sgUser.directions.push(currCalibration);

		//update number of calibrations and see if we're done for this user
		sgUser.calibrations++;

		//if this is not the hub, store
		if (!sgUser.isHub && sgUser.calibrations === 1) {
			//then we've just calibrated with hub; store position
			//the user's device's 0 angle is the angle he held it when starting the app
			//this is de angle to the hub relative to that starting angle
			//we do not yet know how his starting angle relates to the hubs coordinate system!
			sgUser.directionToHub = dir;
		}

		//deze hebben we toch nodig

		if (sgUser.idx === 0 || sgUser.calibrations === 2) {
			//then we only have to calibrate with one user, so we're done
			updateUser('hasCalibrated', true);
			console.log('I\'m idx'+sgUser.idx+'; I am done');
			//notify that calibration is done; will be picked up by hub
			emitEvent('calibrationready.positionawaresockets', sgUser.directions);
		} else if (sgUser.idx === 1 && sgUser.calibrations === 1 && sgUsers.length === 2) {
			//idx1 has calibrated, but we only have idx0 and idx1
			//idx1 could start interacting with idx0
			//but we're not done until idx2 joins and we calibrate with idx2
			console.log('Im idx1; I am done for now, but need more');
		} else {
			//this is >= idx2 who has done first calibration (with idx0)
			//they have to calibrate with the previous joined user
			console.log('I\'m idx'+sgUser.idx+'; I have done 1st calibration');
			showCalibration();
		}

		//newer
		/*
		if (sgUser.idx <= 1 || sgUser.calibrations === 2) {
			//idx0 and idx1 only have to calibrate with one user, others with 2
			updateUser('hasCalibrated', true);
			console.log('I\'m idx'+sgUser.idx+'; I am done');
			//emitEvent('calibrationupdate.positionawaresockets', sgDirections);
			//notify that calibration is done; will be picked up by hub
			emitEvent('calibrationready.positionawaresockets', sgUser.directions);
		} else {
			//we need to update with one more user
			showCalibration();
		}
		*/

		//send the updated directions object to the other sockets
	};


	/**
	* initialize the calibration form
	* @returns {undefined}
	*/
	var initCalibrationForm = function() {
		$('#calibration-form').on('submit', calibrationHandler);
	};


	/**
	* initialize the remote
	* @returns {undefined}
	*/
	var initRemote = function() {
		sgUser.id = io.id;
		sgUser.username = io.id;
		setUserName();
		displayIdentifier();
		setUserColor();
		initSocketListeners();
		initDeviceOrientation();
		initLoginForm();
		initCalibrationForm();
		//joinRoom();
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