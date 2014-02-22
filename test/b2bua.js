var drachtio = require('..')
,app = drachtio()
,siprequest = app.uac
,RedisStore = require('drachtio-redis')(drachtio) 
,d = require('./fixtures/data')
,debug = require('debug')('drachtio:b2bua') ;

app.connect({
    host: 'localhost'
    ,port: 8022
    ,secret: 'cymru'
}) ;

app.use( drachtio.session({store: new RedisStore({host: 'localhost'}) }) ) ;
app.use( drachtio.dialog() ) ;
app.use( app.router ) ;

app.invite(function(req, res) {

    req.session.startTime = new Date() ;

    var gotResponse = false ;
    siprequest( '209.251.49.158', {
        headers:{
            'content-type': 'application/sdp'
        },
        body: req.body
    }, function( err, invite, uacRes ) {

        if( err ) throw( err ) ;

        debug('received response to uac invite with status code %d', uacRes.statusCode ) ;

        var headers = {} ;
        if( uacRes.statusCode === 200 ) headers['content-type'] = uacRes.get('content-type').type ;
        res.send( uacRes.statusCode, {
            headers: headers
            ,body: uacRes.body
        }) ;
    }) ;
}) ;

app.on('sipdialog:create', function(e) {
    var dialog = e.target ;
    var session = e.session ;

    session[dialog.role === SipDialog.UAC ? 'uacLeg': 'uasLeg'] = dialog ;
    session.username = 'daveh' ;
    e.sessionSave() ;

    debug('sipdialog:create handler for dialog with id %s', dialog.dialogID) ;
})
.on('sipdialog:terminate', function(e) {
    var dialog = e.target ;
    var session = e.session ;

    debug('release came on %s dialog', dialog.role ) ;
    if( dialog.role === SipDialog.UAS ) {
        session.uacLeg.terminate() ;
    }
    else {
        session.uasLeg.terminate() ;
    }

    var duration = new Date() - session.startTime() ;
    
    debug('dialog with role %s and dialogID %s was terminated due to %s', dialog.role, dialog.dialogID, e.reason ) ;
}) ;





