var drachtio = require('..')
,app = drachtio()
,siprequest = app.uac
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

    /* send new INVITE back to sender */
    var gotResponse = false ;
    siprequest( req.get('contact'), {
        headers:{
            'content-type': 'application/sdp'
        },
        body: req.body
    }, function( err, invite, uacRes ) {

        if( err ) throw( err ) ;

        if( !gotResponse ) {
            /* save mapping between call ids */
            req.sessionStore.set( req.get('call_id'), {
                otherCallId: invite.get('call_id')
            }) ;
            req.sessionStore.set( invite.get('call_id'), {
                otherCallId: rqe.get('call_id')
            }) ;
            gotResponse = true ;
        }

        res.send( uacRes.statusCode, {
            headers: {
                'content-type': uacRes.get('content-type')
            }
            ,body: uacRes.body
        }) ;
    }) ;
}) ;

app.on('sipdialog:create', function(e) {
    debug('sipdialog:create handler') ;

    var dialog = e.target ;

})
.on('sipdialog:terminate', function(e) {
    var dialog = e.target ;
    
    debug('dialog with role %s was terminated due to %s', dialog.role, e.reason ) ;

    dialog.sessionStore.get( dialog.call_id, function( err, otherCallId){
        if( err ) throw( err ) ;
        debug('matching callid we need to send BYE on is %s', otherCallId) ;

        SipDialog.loadFromSessionStore( dialog.sessionStore, otherCallId, dialog.role === 'uac' ? 'uas': 'uac', function( err, dlg){
            if( err ) throw( err ) ;

            debug('terminating dialog ', dlg) ;
            dlg.terminate() ;
        })
    })
}) ;





