(function($) {

	'use strict';

	/* global io */ //instruction for jshint

	//globals:
	//window.io is defined by socket.IO.
	//It represents the socket server.
	//io is a bit of a strange name, but it's being used in examples everywhere,
	//so let's stick to that.


	// define semi-global variables (vars that are "global" in this file's scope) and prefix them
	// with sg so we can easily distinguish them from "normal" vars
	var sgRole = 'hub',
		$sgOrientationTable = $('#orientation-table'),
		sgDeviceIdPrefix = 'device-',//prefix used for device elements' ids
		$sgDevices = $('#devices-container'),
		sgUsers = [];//array of users, in order of joining

	
	/**
	* add identifier for this user
	* @returns {undefined}
	*/
	var initIdentifier = function() {
		$('#id-box').find('.user-id').text(io.id);
	};


	/**
	* handle socket's acceptance of join request
	* @param {object} data Data sent by the socket (currently empty)
	* @returns {undefined}
	*/
	var joinedHandler = function(data) {
		//this hub has been joined the room
	};


	/**
	* create a device on screen for a user
	* @param {object} data Info about the newly connected user
	* @returns {undefined}
	*/
	var createDevice = function(data) {
		var deviceId = sgDeviceIdPrefix+data.id,
			$clone = $('#clone-src')
				.find('.user-device')
				.clone()
				.attr('id', deviceId)
				.find('.user')
					.text(data.username)
				.end()
				.find('.user-color')
					.css('background', data.color)
				.end()
				.hide()
				.appendTo($sgDevices)
				.fadeIn();
	};


	/**
	* remove a device from screen
	* @returns {undefined}
	*/
	var removeDevice = function(id) {
		var deviceId = sgDeviceIdPrefix+id;
		$('#'+deviceId).fadeOut(function(){$(this).remove();});
	};
	


	/**
	* handle entry of new user in the room
	* @param {object} users Updated array with users; the newly added user is the last one in the array
	* @returns {undefined}
	*/
	var newUserHandler = function(users) {
		//console.log('new user has joined: '+data.id+' ('+data.role+')');
		var newUser = users[users.length-1];

		sgUsers = users;
		// console.log(users);
		// console.log(newUser);
		if (newUser.role === 'remote') {
			createDevice(newUser);
		}
		//data.users is object; transform to array
		console.log('new user. number of users:'+sgUsers.length);
		//console.log(data);
	};


	/**
	* handle user disconnecting
	* @param {object} data Object containing disconnected user's id
	* @returns {undefined}
	*/
	var disconnectHandler = function(data) {
		//console.log('disconnect', data);
		if (data.removedUser) {
			//there is no removed user when a client disconnects that hadn't joined the room yet
			var removedUserId = data.removedUser.id;
			removeDevice(removedUserId);
		}
	};
	


	/**
	* handle the orientation change of one of the remote devices
	* @param {object} data Data sent by remote.js's tiltchange event
	* @returns {undefined}
	*/
	var tiltChangeHandler = function(data) {
		var orientation = data.orientation;

		var dirCorrection = 0;//direction is determined by the devices angle relative to the screen at the time of connecting

		orientation.tiltFB -= 90;//tiltFB = 0 when remote device is horizontal, we want it to correspond with vertical screen
		orientation.dir += dirCorrection;

		var rotateLR = "rotate3d(0,0,1, "+ orientation.tiltLR +"deg)",
			rotateFB = "rotate3d(1,0,0, "+ (orientation.tiltFB*-1)+"deg)",
			rotateDir = "rotate3d(0,0,1, "+(orientation.dir*-1)+"deg)";

		var $device = $('#'+sgDeviceIdPrefix+data.id).find('.device');//TODO: move devices in array and search array
		
		var css = {
			transform: rotateLR+' '+rotateFB+' '+rotateDir
		};

		$device.css(css);
		//showOrientationData(data);
	};


	//-- Start debug-functions --
	
		/**
		* show orientation data DIFFERENT DEVICES ARE NOT DISTINGUISHED YET
		* @param {object} data Data sent by remote.js's tiltchange event
		* @returns {undefined}
		*/
		var showOrientationData = function(data) {
			sgOrientationTable.removeClass('u-hidden');
			var orientation = data.orientation;

			var h = '<tr>';
				h += '<td>'+orientation.tiltLR+'</td>';
				h += '<td>'+orientation.tiltFB+'</td>';
				h += '<td>'+orientation.dir+'</td>';
				h += '</td>';

			$sgOrientationTable.append(h);
			var $trs = $sgOrientationTable.find('tr');
			if ($trs.length === 12) {
				$trs.eq(1).remove();
			}
		};
		
	
	//-- End debug-functions --",
	

	/**
	* add event listeners for socket
	* @returns {undefined}
	*/
	var initSocketListeners = function() {
		io.on('joined', joinedHandler);
		io.on('newuser', newUserHandler);
		io.on('disconnect', disconnectHandler);
		io.on('tiltchange', tiltChangeHandler);
	};


	/**
	* send event to server to request entry to room
	* @returns {undefined}
	*/
	var joinRoom = function() {
		var data = {
				role: sgRole,
				id: io.id,
			};

		//tell socket we want to join the session
		io.emit('join', data);
	};
		
	
	/**
	* initialize this hub when
	* @param {string} varname Description
	* @returns {undefined}
	*/
	var initHub = function() {
		initIdentifier();
		initSocketListeners();
		joinRoom();
	};

	
	/**
	* kick off the app once the socket is ready
	* @param {event} e The ready.socket event sent by socket js
	* @param {Socket} socket This client's socket
	* @returns {undefined}
	*/
	var connectionReadyHandler = function(e, io) {
		if (io) {
			initHub();
		}
	};
	
	
	/**

	* initialize the app
	* (or rather: set a listener for the socket connection to be ready, the handler will initialize the app)
	* @returns {undefined}
	*/
	var init = function() {
		$(document).on('connectionready.socket', connectionReadyHandler);
	};

	$(document).ready(init);

})(jQuery);