// This is the server-side file of our position-aware sockets.
// It initializes socket.io and a new express instance.
// Start it by running 'node socket-position-server.js' from your terminal.

/* global require, process, __dirname */ //instruction for jshint


// Define global vars for external stuff - keep default names for consistence
var express,
	app,
	port,
	io;

// define own global variables and prefix them
// so we can easily distinguish them from "normal" function-scope vars
// we usually prefix semi-globals with sg, so it would make sense to prefix with g now
// but we'll stick to sg to be able to easily copy variable names etc
var sgRooms,
	sgRoomname = 'defaultRoom',//we'll only be using one room
	sgUsers = [],
	sgPositions = [],
	sgAngles = [],// array with for every user an array containing its angles to all other users
	sgMaxPointingDeviation = 30,// maximum deviation on either side from the registered angle to a user; you're pointing at a user when you point within (registeredAngle - sgMaxPointingDeviation and registeredAngle + sgMaxPointingDeviation)
	sgReferenceLength = 100;



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
		sgRooms = io.on('connection', function (socket) {

			// A new client has come online.
			var data = {
				users: sgUsers
			};
			socket.emit('connectionready', data);

			socket.on('disconnect', function(){
				disconnectHandler(socket);
			});

			socket.on('join', function(data) {
				joinHandler(socket, data);
			});

			socket.on('leave', function(data) {
				leaveHandler(socket);
			});

			socket.on('newcalibration', function(user) {
				newcalibrationHandler(socket, user);
			});

			socket.on('updateusers', function(data) {
				updateusersHandler(socket, data);
			});

			socket.on('reset', reset);

			//set handler for events that only have to be passsed on to all sockets
			socket.on('passthrough', passThroughHandler);

			socket.on('getusers', getusersHandler);
		});
	};

//-- End basic setup --



//-- Start user management functions --


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
	* remove a user from the sgUsers array
	* @returns {object} The removed user's user object
	*/
	var removeUser = function(id) {
		var removedUser = null;
		for (var i=0, len=sgUsers.length; i<len; i++) {
			if (sgUsers[i].id === id) {
				removedUser = sgUsers.splice(i,1)[0];//splice returns array, so take element 0 of that
				break;
			}
		}
		return removedUser;
	};


	/**
	* handle request for users object by socket
	* @param {socket object} socket The socket requesting the users object
	* @returns {undefined}
	*/
	var getusersHandler = function(socket) {
		
		var data = {
			users: sgUsers
		};
	};


	/**
	* handle user leaving
	* @param {socket object} socket The leaving socket
	* @returns {undefined}
	*/
	var leaveHandler = function(socket) {

		socket.leave(sgRoomname);
		
		var removedUser = removeUser(socket.id);
		
		var data = {
			removedUser: removedUser,
			users: sgUsers
		};
		sgRooms.emit('userleft', data);

		return data;
	};
	
	


	/**
	* handle user disconnecting (closing browser window)
	* @param {socket object} socket The disconnecting socket
	* @returns {undefined}
	*/
	var disconnectHandler = function(socket) {
		// console.log('user '+socket.id+' disconnected\n');
		var data = leaveHandler(socket);

		//io.sockets.adapter contains two objects: rooms and sids which are similar
		//rooms contains an object for every socket, and one for every room
		//sids only contains an object for every socket.
		//so the ones that are in rooms but not in sids are the rooms the socket was in.
		sgRooms.emit('disconnect', data);
	};


	/**
	* handle new user joining the room
	* @param {socket object} socket The socket requesting to join
	* @param {object} user Object containing data about the user
	* @returns {undefined}
	*/
	var joinHandler = function(socket, user) {
		socket.join(sgRoomname);

		// console.log('join:', user);

		//add stuff server manages to user
		var idx = sgUsers.length;//index in sgUsers array for easy reference
		// console.log('idx:',idx);
		user.idx = idx;

		if (idx === 0) {
			//this user is the reference user
			user.isRef = true;
		}

		//add the new user's data to the sgUsers array
		sgUsers.push(user);

		//send message to newly joined user
		socket.emit('joined', sgUsers);

		//send message to rest of the room
		socket.broadcast.emit('newuser', sgUsers);

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
		sgUsers = data.users;
		sgRooms.emit('updateusers', data);
	};


	/**
	* notify the other users of a change in one of the users
	* @param {object} user The changed user
	* @returns {undefined}
	*/
	var emitUsersChange = function(user) {
		var data = {
			users: sgUsers,
			changedUser: user
		};	
		sgRooms.emit('updateusers', data);
	};


	/**
	* 
	* @returns {undefined}
	*/
	var reset = function() {
		console.log('reset');
		// io.sockets.in(sgRoomname).leave(sgRoomname);
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
	* convert an angle in the device's coordinate space to the grid's coordinate space
	* @param {number} deviceAngle The angle in the device's coordinate space
	* @param {object} user The user for whom we want to do the conversion
	* @returns {number} The converted angle
	*/
	var convertToGridAngle = function(deviceAngle, user) {
		var angleToGrid = user.angleToGrid,
			gridAngle = deviceAngle - angleToGrid;

		// console.log('convertToGridAngle - user:', user.idx);
		// console.log('convertToGridAngle - deviceAngle:', deviceAngle);
		// console.log('convertToGridAngle - angleToGrid:', angleToGrid);
		// console.log('convertToGridAngle - gridAngle:', gridAngle);

		gridAngle = rebaseTo180(gridAngle);

		// console.log('convertToGridAngle - rebaseTo180 gridAngle:', gridAngle);
			
		return gridAngle;
	};
	


	/**
	* calculate a device's angle to the default grid system
	* @param {object} user The user object
	* @param {object} calibration The user's last calibration
	* @returns {the angle to the grid}
	*/
	var calculateAngleToGrid = function(user, calibration) {
		//special cases
		//console.log('calculateAngleToGrid', user.idx);
		var angleToGrid;
		if (user.idx === 0) {
			//its the first user; by definition, toGrid is angle to idx1
			angleToGrid = calibration.angle;
			//console.log('0 to grid: ', angleToGrid);
		} else {
			//get other user's info; his last angle is the one to current
			var angleToOtherUser = calibration.angle,
				otherUser = getUserById(calibration.toId),
				otherUserToCurr = getLastUserAngle(otherUser);
			// console.log('otherUser:', otherUser.idx);
			// console.log('otherUserToCurr: ', otherUserToCurr);

			var otherUserToCurrOnGrid = convertToGridAngle(otherUserToCurr, otherUser);
			// console.log('otherUserToCurrOnGrid:', otherUserToCurrOnGrid);
			angleToGrid = angleToOtherUser - otherUserToCurrOnGrid - 180;
			// console.log('angleToGrid for user', user.idx);
		}

		angleToGrid = rebaseTo180(angleToGrid);
		// console.log('rebased angleToGrid for user', user.idx,':', angleToGrid);

		return angleToGrid;
	};


	/**
	* get the user's angle to another user that was determined last
	* @param {object} user The user object from the user whose last angle we want
	* @returns {number} the angle
	*/
	var getLastUserAngle = function(user) {
		var angle = user.angles[user.angles.length-1].angle;

		return angle;
	};


	/**
	* get the grid angle for user B to user A, based on the grid angle for user A to user B
	* @param {number} gridAngle The grid angle from A to B
	* @returns {number} The rebased grid angle from B to A
	*/
	var getOtherUserGridAngle = function(gridAngle) {
		var absAngle = Math.abs(gridAngle),
			oppositeGridAngle = 180 - absAngle;

		if (gridAngle > 0) {
			oppositeGridAngle = -oppositeGridAngle;
		}

		return oppositeGridAngle;
	};
	
	
	
	


	/**
	* update the object with all user's angles to all other users
	* @returns {undefined}
	*/
	var updateAngles = function() {
		
	};
	

	/**
	* calculate a user's position within the grid's coordinate system
	* @param {user object} user The user whose position to calculate
	* @returns {object} The users object position {x:x, y:y}
	*/
	var getCalculatedPosition = function(user) {
		//console.log('calculate pos for user', user.idx);
		var x,
			y;
			
		if (user.idx === 0) {
			x = 0;
			y = 0;
		} else if (user.idx === 1) {
			//put on default reference length
			x = 0;
			y = sgReferenceLength;
		} else {
			// for sake of this calculation:
			// let's call the idx of the user to check n
			// user calibrates with idx0 (nodeA)
			// call idx0 userA, the user we're investigating userN, idx-n and the previous user userM idx-m
			// see the image in docs/calculations.png

			var n = user.idx,
				m = n-1,
				userA = sgUsers[0],
				userN = user,
				userM = sgUsers[m];
			
			// determine angle from  A to N
			var na = userN.angles[0].angle,
				naGrid = convertToGridAngle(na, userN),
				anGrid = getOtherUserGridAngle(naGrid);

			// get angle from M to N
			var mn = getLastUserAngle(userM),
				mnGrid = convertToGridAngle(mn, userM),
				nmGrid = getOtherUserGridAngle(mnGrid);

			// get userM's position values
			var mx = userM.position.x,
				my = userM.position.y;

			// based on the lengths of AN and MN and the angles, we can calculate the x- and y-distance of N to A and M
			// determine check if we have to add or subtract these lengths from a.x, a.y, m.x and m.y
			var ANxPosNeg = (anGrid > 0) ? 1 : -1,//if (anGrid > 0), N is to right of A, use +1, else -1
				ANyPosNeg = (Math.abs(anGrid) < 90) ? 1 : -1,// if angle is between -90 and 90, N is below A (so has *higher* y value), 1 else -1
				MNxPosNeg = (mnGrid > 0) ? 1 : -1,//if (mnGrid > 0), N is to right of M, use +1, else -1
				MNyPosNeg = (Math.abs(mnGrid) < 90) ? 1 : -1;// if angle is between -90 and 90, N is below M (so has *higher* y value), 1 else -1

				// console.log('ANxPosNeg:', ANxPosNeg, 'ANyPosNeg', ANyPosNeg);
				// console.log('MNxPosNeg:', MNxPosNeg, 'MNyPosNeg', MNyPosNeg);

			// console.log('anGrid:', anGrid, 'naGrid:', naGrid, 'mnGrid:', mnGrid, 'nmGrid:', nmGrid);

			// create vars for absolute values of sin and cos of smallest angles - these are the angles inside the AMN triangle
			//determine smallest angles
			var anOrNaGridMin = Math.min(Math.abs(anGrid), Math.abs(naGrid)),
				mnOrNmGridMin = Math.min(Math.abs(mnGrid), Math.abs(nmGrid));

			//Math.sin and Math.cos expect radians, not degrees
			var anOrNaGridMinRad = degreesToRadians(anOrNaGridMin),
				mnOrNmGridMinRad = degreesToRadians(mnOrNmGridMin);

			var sinan = Math.abs(Math.sin(anOrNaGridMinRad)),
				cosan = Math.abs(Math.cos(anOrNaGridMinRad)),
				sinmn = Math.abs(Math.sin(mnOrNmGridMinRad)),
				cosmn = Math.abs(Math.cos(mnOrNmGridMinRad));

			// console.log('anOrNaGridMin:', anOrNaGridMin, 'sinan:', sinan, 'cosan:', cosan);
			// console.log('mnOrNmGridMin:', mnOrNmGridMin, 'sinnn:', sinmn, 'cosnn:', cosmn);

			// calculate length of MN
			var MN = ( my/(ANyPosNeg*cosan) - mx/(ANxPosNeg*sinan) ) / ( (MNxPosNeg*sinmn)/(ANxPosNeg*sinan) - (MNyPosNeg*cosmn)/(ANyPosNeg*cosan) ),
				nx = mx + MNxPosNeg * MN * sinmn,
				ny = my + MNyPosNeg * MN * cosmn;

			// console.log('MN:', MN);

			// console.log('nx:', nx, 'ny:', ny);

			//console.log('na:',na, 'naGrid:', naGrid, 'anGrid:',anGrid);
			//console.log('mn:',mn, 'mnGrid:', mnGrid, 'nmGrid:',nmGrid);
			x = nx;
			y = ny;

		}
		
		var position = {
			x: x,
			y: y
		};

		if (user.idx === 0) {
			// console.log('\n-----------------------------------------------\n');
		}
		// console.log(position);

		return position;
	};
	

	/**
	* calculate a user's position within the grid's coordinate system
	* @param {user object} user The user whose position to calculate
	* @returns {object} The users object position {x:x, y:y}
	*/
	var getCalculatedPosition_bak = function(user) {
		//console.log('calculate pos for user', user.idx);
		var x,
			y;
			
		if (user.idx === 0) {
			x = 0;
			y = 0;
		} else if (user.idx === 1) {
			//put on default reference length
			x = 0;
			y = sgReferenceLength;
		} else {
			// for sake of this calculation:
			// let's call the idx of the user to check n
			// user calibrates with idx0 (nodeA)
			// call idx0 node A, idx1 node B and the user we want to calculate node C.
			// see the image in docs/calculations.png

			//calculate angles bac, abc and acb
			var nodeB = sgUsers[1],
				ba = nodeB.angles[0].angle,//angle from B to A
				bc = nodeB.angles[1].angle,//angle from B to C
				abc = getAngle(ba, bc);
			// console.log('ba:', ba, 'bc:', bc, 'abc:', abc);

			var nodeC = user,
				ca = nodeC.angles[0].angle,//angle from C to A
				cb = nodeC.angles[1].angle,//angle from C to B
				acb = getAngle(ca, cb);
			// console.log('ca:', ca, 'cb:', cb, 'acb:', acb);

			//TODO REPLACE BY ACTUAL VALUES
			//abc = 60;
			//acb = 40;

			var bac = 180 - abc - acb,
				bacRadians = degreesToRadians(bac);

			var AB = sgReferenceLength,
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
		} else {
			//userCalibrations === 2; calibrate with next
			otherIdx = idx+1;
		}
		otherUser = sgUsers[otherIdx];

		return otherUser;
	};


	/**
	* handle a new calibration by a user
	* @returns {undefined}
	* @param {socket object} socket The socket sending the event
	* @param {object} user The user that has just calibrated
	*/
	var newcalibrationHandler = function(socket, user) {
		// console.log('newcalibrationHandler');
		var idx = user.idx,
			done = false,
			canBePositioned = false;

		var angles = user.angles,
			lastCalibration = angles[angles.length-1],
			angle = lastCalibration.angle;

		// console.log('calibration from ',idx, 'angle: ', angle);
		// console.log('angleToGrid:', user.angleToGrid);

		// users 0 and 1 can determine their angle to grid on first calibration;
		// other users have to calibrate with their second calibration
		if ( (user.idx <= 1 && user.calibrations === 0) || (user.idx > 1 && user.calibrations === 1) ) {
			user.angleToGrid = calculateAngleToGrid(user, lastCalibration);
		}

		user.calibrations++;
		sgUsers[idx] = user;//update the user
		emitUsersChange(user);


		//see if we're done
		if (user.isRef || user.idx === 1 || user.calibrations === 2) {
			//ref and idx can be positioned after 1st calibration
			canBePositioned = true;
		}
		if (user.isRef || (user.idx === 1 && user.calibrations === 2) || user.calibrations === 3) {
			//ref only has to calibrate with idx1; all other have to calibrate twice
			done = true;
		}

		if (done) {
			//there is a change to send to the rest
			user.hasCalibrated = true;
		}
		// console.log('see if we\'re done: user.idx:', user.idx,' user.calibrations:', user.calibrations, 'done:', done);

		if (canBePositioned && user.isPositioned === false) {
			//when this is true, hasCalibrated is always true
			//console.log('go calc position for idx', idx, ' togrid:', user.angleToGrid);
			var position = getCalculatedPosition(user);
			user.position = position;
			user.isPositioned = true;
			sgPositions.push(position);
			// console.log('pushing position', sgPositions.length, sgPositions);

			//update the object which has every user's angles to all other users
			//updateAngles();

			emitUsersChange(user);

			var positionData = {
				users: sgUsers,
				changedUser: user,
				positions: sgPositions
			};

			//here we can recalculate all users' angles to their peers
			sgRooms.emit('updateposition', positionData);
			//emitUsersChange(user);
		}

		nextCalibration();
	};
	


	
	/**
	* check which socket has to do calibration and notify it
	* @returns {undefined}
	*/
	var nextCalibration = function() {

		var len = sgUsers.length;
		// console.log('nextCalibration; num users:', len);
		if (len > 1) {
			//nothing to calibrate when there's only one user
			for (var i=0; i<len; i++) {
				var user = sgUsers[i];
				// console.log('user',i,' calibrated:',user.hasCalibrated);
				if (!user.hasCalibrated) {
					var id = user.id,
						otherUser = getUserToCalibrateWith(user),
						data = {
							id: id,
							otherUser: otherUser
						};

					// console.log('nextCalibration; up:', user.idx);

					if (otherUser) {
						// console.log('nextCalibration; up:', user.idx, '('+user.idx+'>'+otherUser.idx+')');
						// console.log('next up:', user.username);
						// console.log('otherUser:', otherUser.idx);
						sgRooms.emit('nextcalibration', data);
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
		sgRooms.emit(data.eventName, data.eventData);
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
