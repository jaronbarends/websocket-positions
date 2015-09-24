#websocket remote

Proof-of-concept for creating a remote control using websockets

Uses express node-server in combination with socket.io.

##File structure

The root folder contains the node-server (_socket-server.js_) and the npm stuff. Everything in the folder _public_ can be served by the node-server.

##Javascript modules

The functionalities have been seperated as much as possible into different javascript files to prepare for re-use.

###socket-server.js

This is the server you run to serve the pages: `node socket-server`

The socket-server serves files in the _public_ directory and handles traffic between sockets. Sockets can send events to the socket-server, and then you can add code to the server to handle that event. Mostly, you'll just want to pass it on. ? It may be an idea to create a special type of event that always gets passed through, containing some identifier?

###socket.io.js

External library for handling websockets

###socket.js

Creates a websocket, and lets the _document_ trigger an event `ready.socket` with a data-object containing the socket. Other scripts can listen for that event, and store a reference to the socket.

###hub.js

Code for handling the hub (duh)

###remote.js






##Troubleshooting

python needs ms Visual Studio. Default is 2010, but you'll have to adjust this to your own version: 
 npm install --save socket.io --msvs_version=2013
this line can be  put into package.json under "scripts"
