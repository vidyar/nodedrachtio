var Drachtio = require('..') ;

var agent = new Drachtio() ;

var options = {
	address: 'localhost'
	,port: 8022
	,secret: rugby
	,services: ['front-end']
} ;

agent.connect( options, function(err){
	if( err ) throw err ;
}) ;

/* or
agent.on('connect', function() {
	
})
*/
agent.on('disconnect', function(err){
	if( err ) throw err ;
}) ;

agent.on('error', function(err){

}) ;

agent.invite({}, function( req, res){
	res.redirect( 'prepaid' ) ;
}) ;

