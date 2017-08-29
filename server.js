var express = require('express');

var exp = express();

	// http://localhost:8080/
	exp.get('/', function(req, res) {
		res.sendFile(__dirname + '/views/index.html');
	});

	// start the server on port 8080
	exp.listen(8080);
	console.log('Server has started!');
	
	