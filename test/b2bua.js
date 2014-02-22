var drachtio = require('..')
,app = drachtio()
,siprequest = app.uac
,RedisStore = require('drachtio-redis')(drachtio) 
,d = require('./fixtures/data')
,SipDialog = drachtio.SipDialog 
,debug = require('debug')('drachtio:b2bua') ;

app.connect({
    host: 'localhost'
    ,port: 8022
    ,secret: 'cymru'
}) ;

app.use( drachtio.session({store: new RedisStore({host: 'localhost'}, prefix:'') }) ) ;
app.use( drachtio.dialog() ) ;
app.use( app.router ) ;

app.invite(function(req, res) {

    var gotResponse = false ;
    siprequest( 'sip:msml@209.251.49.158', {
        headers:{
            'content-type': 'application/sdp'
        }
        ,body: req.body
        ,mks: req.mks
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

    var isUAC = dialog.role === SipDialog.UAC  ;
    if( isUAC ) {
        debug('saving UAC dialog ') ;
        session.uacLeg = dialog ;
    }
    else {
        debug('saving UAS dialog') ;
        session.uasLeg = dialog ;
    }
    e.saveSession() ;
})
.on('sipdialog:terminate', function(e) {
    var dialog = e.target ;
    var session = e.session ;

    debug('dialog with role %s and dialogID %s was terminated due to %s', dialog.role, dialog.dialogID, e.reason ) ;
    if( dialog.role === SipDialog.UAS ) {
        debug('sending bye to B leg') ;
        session.uacLeg.terminate() ;
    }
    else {
        debug('sending bye to A leg') ;
        session.uasLeg.terminate() ;
    }
    
}) ;
