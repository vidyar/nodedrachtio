var app = require('..')()
,debug = require('debug')('drachtio:main') ;

 app.set('port', 8022) ;
 app.set('host', 'localhost') ;
 app.set('secret', 'cymru') ;
 app.set('mrcf', 'msml') ;
 
 app.use('request', function( req, res, next){
    debug('my callback, and req looks like this: ', req.headers ) ;
    next() ;
 })

app.connect( function(err){
	if( err ) console.log("Error connecting: " + err) ;
}) ;
app.on('disconnect', function(err){
    if( err ) throw err ;
}) ;

app.on('error', function(err){
    console.log('Error: ' + err) ;
}) ;

app.invite(function(req, res) {
	res.send(180) ;
	setTimeout( function() {
	    res.send(500) ;
	}, 2000) ;
}) ;










