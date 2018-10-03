var PORT = 2010;
var HOST = '127.255.255.255';

var dgram = require('dgram');
var net = require('net');
var readline = require('readline');
var EventEmitter = require('events').EventEmitter;
var util = require('util');


function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}


function IvyBus(appName, broadcastHost, broadcastPort){

	var that = this;

	var nextSubscriptionID = 0;
	var subscriptions = [];
	var peers = [];
	var ready_callback = null;

	var tcpserver = null;

	var appId;

	/*==========UTILITY FUNCTIONS==========*/
	function broadcastMessage(server, message){
		var buf = new Buffer(message);
		server.send(buf, 0, buf.length, broadcastPort, broadcastHost);
	}

	function sendMessage(peer, message){
		var buf = new Buffer(message);
		peer.socket.write(buf);
	}

	function createMessage(type, identifier, params){
		if(!params) params = '';
		return type + " "+identifier+"\u0002"+params+'\n';
	}

	/*=========PROTOCOL SEND MSG===========*/

	//Only UDP message, used to notice your presence to other peers
	function broadcastAvailable(server, tcpAddress){		

		var msg = "3 "+tcpAddress.port+" "+appId+" "+appName+"\n";
		broadcastMessage(server, msg);
	}

	function sendPeerID(peer){
		msg = createMessage('6', tcpserver.address().port, appName);
		sendMessage(peer,msg);
	}

	function sendSubscription(peer, subscription){
		var regString = subscription.regex.toString();
		regString = regString.substr(1, regString.length - 2);
		msg = createMessage('1',subscription.id, regString);
		sendMessage(peer, msg);
	}

	function sendSubscriptionDeletion(subid){
		var subexists = false;
		for(var k in subscriptions){
			if(subscriptions[k].id === 'subid'){
				subscriptions[k].splice(k,1);
				subexists = true;
				break;
			}
		}

		if(! subexists ) return ;

		var msg = createMessage('4', subid)
		for(var k in peers){
			sendMessage(peers[k], msg);
		}
	}

	function sendEndInitialSubscriptions(peer){
		msg = createMessage('5', 0);
		sendMessage(peer, msg);
	}

	function sendError(peer, err){
		msg = createMessage('3', 0, err);
		sendMessage(peer, msg);
	}

	function sendBye(){
		var msg = createMessage('0', 0);
		for(var k in peers){
			sendMessage(peers[k], msg);
		}
	}

	function sendTextMessage(message){
		var count = 0;
		for(var i in peers){ //browse each peer
			for(var j in peers[i].subscriptions){ //browse each peer's subscriptions
				//If a subscription matches the message, send the message to that peer
				var matches = undefined;
				if(matches = message.match(peers[i].subscriptions[j].regex)){
					
					//Format the matched parameters
					var params = '';
					for(var k = 1; k < matches.length; k++){
						params += matches[k]+'\u0003';
					}

					//Send the matched parameters
					var msg = createMessage('2', peers[i].subscriptions[j].id, params);

					sendMessage(peers[i], msg);
					count++;
				}
			}
		}

		return count;
	}
	/*====================================*/

	/*=========PROTOCOL RECV MSG==========*/
	function parseSubscription(peer, identifier, params){
		var sub = {regex: new RegExp(params), id: identifier};
		peer.subscriptions.push(sub);
	}

	function parseEndInitialSubscriptions(peer, identifier, params){
		peer.ready = true;
		that.emit('peerConnected', peer);
	}

	function parsePeerID(peer, identifier, params){
		peer.name = params;
		peer.port = identifier;
	}

	function parseError(peer, identifier, params){
		console.log("Error ("+peer.name+":"+peer.port+") : "+params);
	}

	function parseBye(peer, identifier, params){
		peer.socket.close();
	}

	function parseSubscriptionDeletion(peer, identifier, params){
		for(var k in peer.subscriptions){
			if(peer.subscriptions[k].id === identifier){
				peer.subscriptions.splice(k,1);
				break;
			}
		}
	}

	function parseTextMessage(peer, identifier, params){
		for(k in subscriptions){
			if(subscriptions[k].id === parseInt(identifier)){
				var msgs = params.split("\u0003");
				if(msgs && msgs.length > 0) msgs.splice(msgs.length-1, 1);
				subscriptions[k].cb(msgs);
			}
		}
	}
	/*====================================*/

	var PEER_MSG_REGEX = /^([0-8]) ([0-9]+)\u0002(.*)$/;
	function parsePeerMessage(peer, message){
		var matches = message.match(PEER_MSG_REGEX);
		if(matches === null) {
			console.log("invalid peer message : "+message);
		}

		var type = matches[1];
		var identifier = matches[2];
		var params = matches[3];

		if(type === '0'){
			parseBye(peer, identifier, params);
		}else if(type === '1'){
			parseSubscription(peer, identifier, params);
		}else if(type === '2'){
			parseTextMessage(peer, identifier, params);
		}
		else if(type === '3'){
			parseError(peer, identifier, params);
		}
		else if(type === '4'){
			parseSubscriptionDeletion(peer, identifier, params);
		}
		else if(type === '5'){
			parseEndInitialSubscriptions(peer, identifier, params);
		}
		else if(type === '6'){
			parsePeerID(peer, identifier, params);
		}
	}

	function startInitialSubscriptions(peer){
		sendPeerID(peer);
		for(var k in subscriptions){
			sendSubscription(peer, subscriptions[k]);
		}
		sendEndInitialSubscriptions(peer);
	}


	var PEER_BROADCAST_MSG_REGEX = /^([0-9]+) ([0-9]+) ([^ ]*) (.*)\n$/;
	function onPeerAvailable(message, remote){

		var matches = message.match(PEER_BROADCAST_MSG_REGEX);

		if(!matches) return ;

		var protocolVersion = matches[1];
		var remotePort = matches[2];
		var remoteId = matches[3];
		var remoteName = matches[4];

		//this is me, get the hell outta there
		if(remoteId === appId) return ;

		var socket = new net.Socket();
		socket.connect(remotePort, remote.address, function(){
			var peer = onPeerConnection(socket);
			peer.id = remoteId;
		});
	}

	function onPeerConnection(socket){

		var peer = {socket: socket, subscriptions: []};

		//Add peer to the liste of connected peers
		peers.push(peer);

		//Listen for incoming messages (on a line-by-line basis)
		var i = readline.createInterface(socket, socket);
		i.on('line', function(line){
			parsePeerMessage(peer, line);
		});

		//Handle the closing of a socket
		socket.on('close', function(){
			i.close();
			for(var k in peers){
				if(peers[k].socket === socket){
					peers.splice(k,1);
					break;
				}
			}
			that.emit('peerQuit', peer);
		});

		startInitialSubscriptions(peer);

		return peer;
	}

	function startBroadcasting(tcpAddress){
		var server = dgram.createSocket({type: 'udp4', reuseAddr: true});

		server.on('listening', function () {
			server.setBroadcast(true);
			var address = server.address();
			console.log('Broadcasting on network ' + address.address + ", port " + address.port);
			broadcastAvailable(server,tcpAddress);
		});

		server.on('message', function (message, remote) {
			onPeerAvailable(message.toString('ascii'), remote);   
		});

		server.bind(broadcastPort, broadcastHost);
	}

	function startTCPServer(){
		tcpserver = net.createServer(function(socket){

			onPeerConnection(socket);

		}).listen(0, function(e){
			if(e){
				console.log("Cannot open TCP server : "+e);
			}else{
				appId = randomInt(100000000, 9000000000)+":"+Date.now()+":"+tcpserver.address().port;
				startBroadcasting(tcpserver.address());
			}
		});
	}



	/*==============PUBLIC API=====================*/

	this.subscribe = function(regex, callback){
		var sub = {regex: regex, cb: callback, id: nextSubscriptionID};
		subscriptions.push(sub);
		nextSubscriptionID++;
		return sub.id;
	}

	this.unsubscribe = function(subid){
		sendSubscriptionDeletion(subid);
	}

	this.start = function(){
		startTCPServer();
	}

	this.stop = function(){
		sendBye();
	}

	this.send = function(message){
		return sendTextMessage(message);
	}
}

util.inherits(IvyBus, EventEmitter);


module.exports = IvyBus;
