var IvyBus = require('./ivy');
var readline = require('readline');

var GetOpt = require('node-getopt');

var getopt = new GetOpt([
	['b', '='],
	['p', '='],
	['n', '=']
]).bindHelp();


var opt = getopt.parse(process.argv.slice(2));

if(opt.argv.length < 1) {
	console.log("No regex specified. Abort.");
	process.exit(1);
}

var regex = opt.argv[0];

var addr = opt.options['b'] ? opt.options['b'] : '127.255.255.255';
var port = opt.options['p'] ? opt.options['p'] : 2010;
var name = opt.options['n'] ? opt.options['n'] : 'ivyprobe-js';

var ivy = new IvyBus(name, addr, port);
var subid = ivy.subscribe(new RegExp(regex), function(params){
	console.log(params);
});
ivy.start();
ivy.on('peerConnected', function(peer){
	console.log(peer.name+" connected from "+peer.socket.address().address);
});

ivy.on('peerQuit', function(peer){
	console.log(peer.name+" disconnected");
});

var input = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

input.on('line', function(line){
	var c = ivy.send(line.toString());
	console.log('-> Sent to '+c+' peer'+(c > 1 ?'s':''));
})