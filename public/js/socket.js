(function($) {

	'use strict';

	/* global io */ //global io is defined by socket.io

	// define semi-global variables (vars that are "global" in this file's scope) and prefix them
	// with sg so we can easily distinguish them from "normal" vars


	/**
	* handle server's connectionready event
	* @returns {undefined}
	*/
	var connectionreadyHandler = function(data) {
		// console.log('ready:',data);
		var newData = {
			io: io,
			users: data.users
		};
		$(document).trigger('connectionready.socket', newData);
	};
	

	/**
	* initialize the socket, and send event containing it to the page
	* @param {string} varname Description
	* @returns {undefined}
	*/
	var initIo = function() {
		io = io();
		io.on('connectionready', connectionreadyHandler);
	};
	

	/**
	* initialize all
	* @param {string} varname Description
	* @returns {undefined}
	*/
	var init = function() {
		initIo();
	};

	$(document).ready(init);


})(jQuery);