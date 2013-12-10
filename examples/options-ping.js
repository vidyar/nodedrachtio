var app = require('..')()
,siprequest = app.uac
,config = require('./test-config')
,debug = require('debug')('drachtio:example-options-ping') ;

app.connect( config ) ;

app.once('connect', function() {
	siprequest.options('sip:1234@192.168.173.139', function( err, req, res ) {
		if( err ) {
			console.error( err ) ;
		}
		else {
		    debug('status is ', res.statusCode ) ;
		}
	    app.disconnect() ;
	}) ;
}) ;



