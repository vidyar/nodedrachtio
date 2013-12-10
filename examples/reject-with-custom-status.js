var app = require('..')()
,config = require('./test-config')
,debug = require('debug')('drachtio:main') ;
 
app.connect( config ) ;

app.invite(function(req, res) {
	res.send( 500, 'Internal Server Error - Database down',{
		headers: {
			'User-Agent': 'Drachtio rocksz'
			,'Server': 'drachtio 0.1'
			,'X-My-Special-thingy': 'isnt my custom header shiny pretty?'
		}
	}) ;
}) ;
