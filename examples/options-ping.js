var app = require('..')()
,siprequest = app.uac
,debug = require('debug')('drachtio:example-options-ping') ;

app.set('port', 8022) ;
app.set('host', 'localhost') ;
app.set('secret', 'cymru') ;
 
app.connect( function(err){
	if( err ) throw err ;

    siprequest.options('sip:1234@192.168.173.139', function( req, res ) {
        debug('status is ', res.statusCode ) ;
        app.disconnect() ;
    }) ;
}) ;




