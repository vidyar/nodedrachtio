var app = require('..')()
,config = require('./test-config')
,debug = require('debug')('drachtio:main') ;
 
app.connect( config, function(e){
	debug('hostport, %s', e.hostport) ;
	debug('sip address: %s', app.get('sip address')) ;
	debug('sip port: %d', app.get('sip port')) ;
}) ;

app.invite(function(req, res) {
	res.send(180) ;

	/* reject 2 seconds later */
	setTimeout( function() {
	    res.send(500) ;
	}, 2000) ;
}) ;










