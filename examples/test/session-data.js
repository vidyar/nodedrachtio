var drachtio = require('../..')
,app = drachtio()
,Session = drachtio.MultiKeySession
,RedisStore = require('drachtio-redis')(drachtio) 
,d = require('../fixtures/data')
,debug = require('debug')('drachtio:session-data') ;

app.connect({
    host: 'localhost'
    ,port: 8022
    ,secret: 'cymru'
}) ;

var store = new RedisStore({host: 'localhost'}) ;

app.use( drachtio.session({store: store}) ) ;
app.use( drachtio.dialog() ) ;
app.use( app.router ) ;

app.invite(function(req, res) {

    res.send(200, {
        headers: {
            ,'content-type': 'application/sdp'
        }
        ,body: d.dummySdp
    }) ;
}) ;

app.on('sipdialog:create', function(e) {
    debug('sipdialog:create handler') ;
    var dialog = e.target ;

    var session = new Session({store: store, ttl: 6400}) ;
    session.add( dialog.sessionID, 'aLeg', dialog) ;
    session.add('myData', {user: 'DaveH'}) ;
})
.on('sipdialog:terminate', function(e) {
    var dialog = e.target ;

    Session.retrieve( dialog.sessionID, function( err, session ) {
        debug('myData.user: %s', session.myData.user) ;

        session.destroy() ;
    }) ;
    debug('dialog was terminated due to %s', e.reason ) ;
}) ;





