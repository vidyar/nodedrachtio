var drachtio = require('..')
,app = drachtio()
,RedisStore = require('drachtio-redis')(drachtio) 
,d = require('./fixtures/data')
,debug = require('debug')('drachtio:session-expires-uas') ;

app.connect({
    host: 'localhost'
    ,port: 8022
    ,secret: 'cymru'
}) ;

app.use( drachtio.session({store: new RedisStore({host: 'localhost'}) }) ) ;
app.use( drachtio.dialog() ) ;
app.use( app.router ) ;

app.invite(function(req, res) {

    res.send(183, {
        headers: {
            'require': '100rel'
            ,'content-type': 'application/sdp'
        }
        ,body: d.dummySdp
    }) ;

    req.prack( function() {
        debug('this is a prack handler, not doing anything though') ;
    })
}) ;

app.on('sipdialog:create-early', function(e) {
    debug('sipdialog:create-early handler')
    var dialog = e.target ;
    dialog.session.user1 = 'DaveH' ;

    e.res.send(200, {
        headers: {
            'content-type': 'application/sdp'
        }
        ,body: d.dummySdp
    }) ;

})
.on('sipdialog:create', function(e) {
    debug('sipdialog:create handler')
    var dialog = e.target ;
    dialog.session.user2 = 'DaveH' ;
})
.on('sipdialog:terminate', function(e) {
    var dialog = e.target ;
    
    debug('dialog was terminated due to %s', e.reason ) ;
    debug('dialog user1 is: %s', dialog.session.user1) ;
    debug('dialog user2 is: %s', dialog.session.user2) ;
 
    app.disconnect() ;
}) ;





