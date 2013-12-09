var Drachtio = exports.drachtio = require('..')
debug = require('debug')('drachtio'), 
util = require('util') ;


var opts = {
	address: 'localhost'
	,port: 8022
	,secret: 'cymru'
	,services: ['front-end','prepaid']
} ;

var agent = new Drachtio(opts) ;

function doConnect() {
	agent.connect( opts, function(err){
		if( err ) {
			console.log("Error connecting: " + err) ;
		}
		else {
			debug('successfully connected') ;
		}
	}) ;	
}

agent.on('disconnect', function(err){
	if( err ) throw err ;
	setTimeout( doConnect, 5000 ) ;
}) ;

agent.on('error', function(err){
	console.log('Error: ' + err) ;
}) ;


/* we want all invites */
agent.invite( function( req, res ) {
	res.send( 500, 'Internal Server Error - Database down',{
		headers: {
			'User-Agent': 'Drachtio rocksz'
			,'Server': 'drachtio 0.1'
			,'From': 'this should be rejected because client can not set the From header (and a few others)'
			,'X-My-Special-thingy': 'isnt my custom header shiny pretty?'
			,'X bad' : 'this should be rejected because the header name is invalid'
		}
	} ) ;
}) ;

doConnect() ;
