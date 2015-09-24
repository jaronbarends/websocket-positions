// This is the server-side file of our position-aware sockets.
// It initializes socket.io and a new express instance.
// Start it by running 'node socket-position-server.js' from your terminal.

/* global require, process, __dirname */ //instruction for jshint


// Define global vars for external stuff - keep default names for consistence
var express,
	app,
	port,
	io;

//define own global vars; prefix them with g so w
// define own global variables and prefix them
// with g so we can easily distinguish them from "normal" function-scope vars
var gRooms,
	gRoomname = 'defaultRoom',//we'll only be using one room
	gUsers = [],
	gPositions = [],
	gAngles = [],// array with for every user an array containing its angles to all other users
	gMaxPointingDeviation = 30,// maximum deviation on either side from the registered angle to a user; you're pointing at a user when you point within (registeredAngle - gMaxPointingDeviation and registeredAngle + gMaxPointingDeviation)
	gReferenceLength = 100;



//-- Start basic setup --
	
	/**
	* initialize basic requirements for the server
	* @returns {undefined}
	*/
	var initBasicRequirements = function() {

		//create express server
		express = require('express');
		app = express();

		//set port that we'll use
		port = process.env.PORT || 3000;// This is needed if the app is run on heroku and other cloud providers:

		// Initialize a new socket.io object. It is bound to 
		// the express app, which allows them to coexist.
		io = require('socket.io').listen(app.listen(port));

		// Make the files in the public folder available to the world
		app.use(express.static(__dirname + '/public'));
	};


	/**
	* create the server where all sockets can be handled
	* @returns {undefined}
	*/
	var createServer = function() {
		gRooms = io.on('connection', function (socket) {

			// A new client has come online. 
			socket.emit('connectionready');

			socket.on('disconnect', function(){
				disconnectHandler(socket);
			});

			socket.on('join', function(data) {
				joinHandler(socket, data);
			});

			socket.on('newcalibration', function(user) {
				newcalibrationHandler(socket, user);
			});

			socket.on('updateusers', function(data) {
				updateusersHandler(socket, data);
			});

			//set handler for events that only have to be passsed on to all sockets
			socket.on('passthrough', passThroughHandler);
		});
	};

//-- End basic setup --



//-- Start user management functions --

	/**
	* remove a user from the gUsers array
	* @returns {object} The removed user's user object
	*/
	var removeUser = function(id) {
		var removedUser;
		for (var i=0, len=gUsers.length; i<len; i++) {
			if (gUsers[i].id === id) {
				removedUser = gUsers.splice(i,1)[0];//splice returns array, so take element 0 of that
				break;
			}
		}
		return removedUser;
	};


	/**
	* handle user disconnecting (closing browser window)
	* @param {socket object} socket The disconnecting socket
	* @returns {undefined}
	*/
	var disconnectHandler = function(socket) {
		// console.log('\n-------------------------------------------');
		// console.log('user '+socket.id+' disconnected\n');

		var removedUser = removeUser(socket.id);
		//console.log(socket.adapter);
		var data = {
			removedUser: removedUser,
			users: gUsers
		};

		//io.sockets.adapter contains two objects: rooms and sids which are similar
		//rooms contains an object for every socket, and one for every room
		//sids only contains an object for every socket.
		//so the ones that are in rooms but not in sids are the rooms the socket was in.
		gRooms.emit('disconnect', data);
	};


	/**
	* handle new user joining the room
	* @param {socket object} socket The socket requesting to join
	* @param {object} user Object containing data about the user
	* @returns {undefined}
	*/
	var joinHandler = function(socket, user) {
		socket.join(gRoomname);

		//add stuff server manages to user
		var idx = gUsers.length;//index in gUsers array for easy reference
		// console.log('idx:',idx);
		user.idx = idx;

		if (idx === 0) {
			//this user is the reference user
			user.isRef = true;
		}

		//add the new user's data to the gUsers array
		gUsers.push(user);

		//send message to newly joined user
		socket.emit('joined', gUsers);

		//send message to rest of the room
		socket.broadcast.emit('newuser', gUsers);

		nextCalibration();
	};


	/**
	* when something about a user changes, that client updates the g array
	* store the updated array and pass the event on to the room
	* @param {socket object} socket The socket requesting to join
	* @param {object} data Object containing updated g array and the updated user {users, changedUser}
	* @returns {undefined}
	*/
	var updateusersHandler = function(socket, data) {
		gUsers = data.users;
		gRooms.emit('updateusers', data);
	};


	/**
	* notify the other users of a change in one of the users
	* @param {object} user The changed user
	* @returns {undefined}
	*/
	var emitUsersChange = function(user) {
		var data = {
			users: gUsers,
			changedUser: user
		};	
		gRooms.emit('updateusers', data);
	};
	

//-- End user management functions --


//-- Start positions & angles--


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
	* for an angle in a circle, get the angle that is inside a triangle
	* @param {number} a The device's rotation angle
	* @returns {number} The inner angle
	*/
	var getInnerAngle = function(a) {
		if (a > 180) {
			a = 180 - a;
		}
		return a;
	};
	

	/**
	* calculate the angle from a device to 2 other devices in a triangle
	* @param {number} a1 The angle to the first device
	* @param {number} a2 The angle to the second device
	* @returns {number} The resulting angle between the devices
	*/
	var getAngle = function(a1, a2) {
		var angle = 0;

		//get the part of the rotations within the triangle
		a1 = getInnerAngle(a1);
		a2 = getInnerAngle(a2);
		a2 = Math.max(a2, 0.001);//prevent division by 0

		if (a1/a2 > 0) {
			// then the device's rotations to the two other devices is in opposite directions
			// subtract the angles
			angle = Math.abs(a1 - a2);
		} else {
			// the the device's rotations to the two other devices is in the same direction
			// add the values
			angle = Math.abs(a1) + Math.abs(a2);
		}

		return angle;
	};
	


	/**
	* update the object with all user's angles to all other users
	* @returns {undefined}
	*/
	var updateAngles = function() {
		
	};
	

	/**
	* calculate a user's position within the ref's coordinate system
	* @param {user object} user The user whose position to calculate
	* @returns {object} The users object position {x:x, y:y}
	*/
	var getCalculatedPosition = function(user) {
		console.log('calculate pos for user', user.idx);
		var x,
			y;
		if (user.idx === 0) {
			x = 0;
			y = 0;
		} else if (user.idx === 1) {
			//put on default reference length
			x = 0;
			y = gReferenceLength;
		} else {
			// for sake of this calculation:
			// let's call the idx of the user to check n
			// user calibrates with idx0 (nodeA)
			// call idx0 node A, idx1 node B and the user we want to calculate node C.
			// see the image in docs/calculations.png

			//calculate angles bac, abc and acb
			var nodeB = gUsers[1],
				ba = nodeB.angles[0].dir,//angle from B to A
				bc = nodeB.angles[1].dir,//angle from B to C
				abc = getAngle(ba, bc);
			// console.log('ba:', ba, 'bc:', bc, 'abc:', abc);

			var nodeC = user,
				ca = nodeC.angles[0].dir,//angle from C to A
				cb = nodeC.angles[1].dir,//angle from C to B
				acb = getAngle(ca, cb);
			// console.log('ca:', ca, 'cb:', cb, 'acb:', acb);

			//TODO REPLACE BY ACTUAL VALUES
			//abc = 60;
			//acb = 40;

			var bac = 180 - abc - acb,
				bacRadians = degreesToRadians(bac);

			var AB = gReferenceLength,
				baz = 90 - abc,
				caz = bac - baz,
				AC = AB*Math.cos(degreesToRadians(baz)) / Math.cos(degreesToRadians(caz));

			x = AC*Math.sin(bacRadians);
			y = AC*Math.cos(bacRadians);

		}
		
		var position = {
			x: x,
			y: y
		};

		return position;
	};	

//-- End positions & angles --



//-- Start calibrations --

	
	/**
	* find the user to which the calibrating user has to point
	* @param {object} user The calibrating user
	* @returns {object | undefined} The user to point to
	*/
	var getUserToCalibrateWith = function(user) {
		var idx = user.idx,
			userCalibrations = user.calibrations,
			otherUser,
			otherIdx;

		if (userCalibrations === 0) {
			if (idx === 0) {
				otherIdx = 1;
			} else {
				otherIdx = 0;
			}
		} else if (userCalibrations === 1) {
			if (idx === 1) {
				//second user to calibrate with is the next user
				otherIdx = idx+1;
			} else {
				//second user to calibrate with is the previous user
				otherIdx = idx-1;
			}
		}
		otherUser = gUsers[otherIdx];

		return otherUser;
	};


	/**
	* handle a new calibration by a user
	* @returns {undefined}
	* @param {socket object} socket The socket sending the event
	* @param {object} user The user that has just calibrated
	*/
	var newcalibrationHandler = function(socket, user) {
		var idx = user.idx,
			done = false,
			canBePositioned = false;

			var dirs = user.angles,
				lastCalibration = dirs[dirs.length-1],
				dir = lastCalibration.dir;

			// console.log('calibration from ',idx, dir)

		gUsers[idx] = user;//update the user

		//see if we're done
		if (user.isRef || user.idx === 1 || user.calibrations === 2) {
			//ref and idx can be positioned after 1st calibration
			canBePositioned = true;
		}
		if (user.isRef || user.calibrations === 2) {
			//ref only has to calibrate with idx1; all other have to calibrate twice
			done = true;
		}

		if (done) {
			//there is a change to send to the rest
			user.hasCalibrated = true;
		}
		if (canBePositioned) {
			//when this is true, hasCalibrated is always true
			var position = getCalculatedPosition(user);
			user.position = position;
			gPositions.push(position);

			//update the object which has every user's angles to all other users
			updateAngles();

			var data = {
				users: gUsers,
				changedUser: user,
				positions: gPositions
			};
			gRooms.emit('updateposition', data);
			//emitUsersChange(user);
		}

		nextCalibration();
	};
	


	
	/**
	* check which socket has to do calibration and notify it
	* @returns {undefined}
	*/
	var nextCalibration = function() {
		// console.log('next calibration');

		var len = gUsers.length;
		if (len > 1) {
			//nothing to calibrate when there's only one user
			for (var i=0; i<len; i++) {
				var user = gUsers[i];
				if (!user.hasCalibrated) {
					var id = user.id,
						otherUser = getUserToCalibrateWith(user),
						data = {
							id: id,
							otherUser: otherUser
						};

					if (otherUser) {
						// console.log('next up:', user.username);
						gRooms.emit('nextcalibration', data);
					} else {
						//if there's no other user, calibration stops for now
						// console.log('no one left to calibrate');
					}
					break;
				}
			}
		}
	};
	

//-- End calibrations --




/**
* handle event that just has to be passed through to all sockets
* this way, we don't have to listen for and handle specific events separately
* @param {object} data Object containing {string} eventName and [optional {object} eventData]
* @returns {undefined}
*/
var passThroughHandler = function(data) {
	if (data.eventName) {
		gRooms.emit(data.eventName, data.eventData);
	}
};


/**
* 
* @param {string} varname Description
* @returns {undefined}
*/
var init = function() {
	initBasicRequirements();
	createServer();
	console.log('Now running on http://localhost:' + port);
};

init();
