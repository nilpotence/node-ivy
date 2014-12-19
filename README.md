# Getting started with *node-ivy*

node-ivy is a pure Javascript implementation of the Ivy Software Bus
(http://www.eei.cena.fr/products/ivy/).

## Install node-ivy

```
npm install node-ivy
```


## Create an ivy bus

```js
	var IvyBus = require('node-ivy');
	...
	var ivy = new IvyBus("MyApp", "127.255.255.255", 2010);
	...
	ivy.start();
```

## Subscribe to a given type of message

```js
	var subId = ivy.subscribe(/myregex ([^ ]*) (.*)/, function(params){
		console.log(params);
	});
```

* The regex describes the format of the messages the user wants to listen to.
* Only messages that match the given regex will trigger the callback.
* _params_ is an array containing the result of every catch block defined in the regex.

## Removing a previously set subscription

```s
	ivy.unsubscribe(subId);
```

## Send a message on the bus

```js
	ivy.send("mymessage");
```

## Listen for other peers on the bus

```js
	ivy.on('peerConnected', function(peer){
		console.log("peer "+peer.name+" connected !");
	});

	ivy.on('peerQuit', function(peer){
		console.log("peer "+peer.name+" disconnected !");
	});
```

## Quit the bus

```js
	ivy.stop();
```