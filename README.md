# Getting started with *node-ivy*

node-ivy is a pure Javascript implementation of the Ivy Software Bus
(http://www.eei.cena.fr/products/ivy/).

## Create an ivy bus

```js
	var IvyBus = require('node-ivy');
	...
	var ivy = new IvyBus("MyApp", "127.255.255.255", 2010);
	...
	ivy.start();
```

## Subscribe to a particular event

```js
	ivy.subscribe(/myregex ([^ ]*) (.*)/, function(params){
		console.log(params);
	});
```

