;(function($) {

	'use strict';

	/* global io */ //instruction for jshint

	//globals:
	//window.io is defined by socket.IO.
	//It represents the socket server.
	//io is a bit of a strange name, but it's being used in examples everywhere,
	//so let's stick to that.

	//define semi-globals (variables that are "global" in this file's anounymous function's scope)
	//prefix them with sg so we can distinguish them from normal function-scope vars
	var sgUser,
		$sgYou = $('#user--you'),
		sgUsers,
		$sgMap = $('#user-map'),
		$sgUserCloneSrc = $('#clone-src').find('.user'),
		$sgRef;//reference user



	/**
	* return the latest user in the users array
	* @returns {object} The user object of the latest user who joined
	*/
	var getLatestUser = function() {
		return sgUsers[sgUsers.length-1];
	};


	/**
	* get a user object by its id
	* @param {string} id The user's id
	* @returns {jQuery object} the user's object
	*/
	var getUserObjectById = function(id) {
		var $user;
		if (sgUser.id === id) {
			$user = $sgYou;
		} else {
			$user = $('#'+id);
		}
		return $user;
	};
	
	

	/**
	* handle socket's acceptance of entry request
	* @param {object} users All users currently in the room
	* @returns {undefined}
	*/
	var joinedHandler = function(users) {
		//this remote has been joined the room
		sgUsers = users;
		sgUser = getLatestUser();//the current user is the last one in the users array
		$sgYou.removeClass('user--unjoined');
		createUser(sgUser, true);
	};


	/**
	* create an avatar for the new user
	* @param {object} user The new user's object
	* @param {boolean} isYou flag to indicate if this is the current user
	* @returns {undefined}
	*/
	var createUser = function(user, isYou) {
		//console.log(user);
		var css = {
			color: user.color
		};
		var $user;

		if (isYou) {
			$user = $sgYou;
		} else {
			$user = $sgUserCloneSrc.clone()
				.find('.initial')
				.text(user.username.charAt(0))
				.end()
				.attr('id', user.id)
				.appendTo($sgMap)
		}

		if (user.isRef) {
			$user.addClass('reference-user');
		}

		$user.find('.avatar')
			.css(css)
	};
	


	/**
	* handle entry of new user in the room
	* @param {object} data Info about the joining user
	* @returns {undefined}
	*/
	var newUserHandler = function(users) {
		sgUsers = users;
		var newUser = getLatestUser();
		//console.log('new user '+newUser.username+' has just joined');
		createUser(newUser);
	};




	/**
	* a user's position has been updated
	* @returns {undefined}
	* @param {object} data Object containing users-array and changeduser {users, changedUser}
	*/
	var updatepositionHandler = function(data) {
		var user = data.changedUser,
			id = user.id,
			$user = getUserObjectById(id);

		var pos = {
			left: user.position.x + 'px',
			top: user.position.y + 'px'
		};

		// console.log(pos);
		if (user.id === sgUser.id) {
			// console.log('its me');
		}

		$user.removeClass('user--has-unknown-position')
			.css(pos);
	};
	


	/**
	* add event listeners for socket
	* @param {string} varname Description
	* @returns {undefined}
	*/
	var initSocketListeners = function() {
		io.on('joined', joinedHandler);
		io.on('newuser', newUserHandler);
		io.on('updateposition', updatepositionHandler);
		//io.on('disconnect', userDisconnectHandler);
	};
	

	/**
	* initialize the remote
	* @returns {undefined}
	*/
	var initPassing = function() {
		initSocketListeners();
	};


	/**
	* kick off the code for passing once the socket connection is ready
	* @param {event} e The ready.socket event sent by socket js
	* @param {Socket} socket This client's socket
	* @returns {undefined}
	*/
	var connectionReadyHandler = function(e, io) {
		if (io) {
			initPassing();
		}
	};


	/**
	* initialize
	* (or rather: set a listener for the socket to be ready, the handler will initialize the app)
	* @returns {undefined}
	*/
	var init = function() {
		$(document).on('connectionready.socket', connectionReadyHandler);
	};


	$(document).ready(init);

})(jQuery);