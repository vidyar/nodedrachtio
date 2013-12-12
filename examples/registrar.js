var drachtio = require('..')
,app = drachtio()
,siprequest = app.uac
,config = require('./test-config')
,debug = require('debug')('drachtio:example-basic-uac') ;
 
app.connect( config ) ;

app.use('register', drachtio.digestAuth('dracht.io', function( realm, user, fn) {
    fn( null, 'foobar') ;
})) ;

//app.use('register', drachtio.digestAuth) ;

app.register( function(req, res) {
    var expires = parseInt( req.get('contact').expires || req.get('expires').delta ) ;
    debug('got register with expires seconds %d', expires) ;
    res.send(200) ;
}) ;





