var drachtio = require('../..')
,app = drachtio()
,RedisStore = require('drachtio-redis')(drachtio) 
,d = require('../fixtures/data')
,debug = require('debug')('drachtio:uas-delay-answer') ;

app.connect({
    host: 'localhost'
    ,port: 8022
    ,secret: 'cymru'
}) ;

app.use( drachtio.session({store: new RedisStore({host: 'localhost'}) }) ) ;
app.use( drachtio.dialog() ) ;
app.use( app.router ) ;

app.invite(function(req, res) {

    res.send(180) ;

    setTimeout( function() {
        req.active && res.send(200, {
            headers: {
                'content-type': 'application/sdp'
            }
            ,body: d.dummySdp
        }) ;

    }, 2000) ;

    req.cancel( function( req, res ){
        debug('request was canceled')
    }) ;
}) ;

app.on('sipdialog:create', function(e) {
    var dialog = e.target ;
    dialog.session.user = 'DaveH' ;
})
.on('sipdialog:terminate', function(e) {
    var dialog = e.target ;
    
    debug('dialog was terminated due to %s', e.reason ) ;
    debug('dialog user is: %s', dialog.session.user) ;
 
    app.disconnect() ;
}) ;





