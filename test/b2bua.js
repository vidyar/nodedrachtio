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

    /* send new INVITE back to sender */
    var gotResponse = false ;
    siprequest( req.msg.source_address + ':' + req.msg.source_port, {
        headers:{
            'content-type': 'application/sdp'
        },
        body: req.body
    }, function( err, invite, uacRes ) {

        if( err ) throw( err ) ;

        /*
        if( !gotResponse ) {
            req.sessionStore.set( req.get('call_id'), {
                otherCallId: invite.get('call_id')
            }) ;
            req.sessionStore.set( invite.get('call_id'), {
                otherCallId: rqe.get('call_id')
            }) ;
            gotResponse = true ;
        }
        */

        debug('received response to uac invite with status code %d', uacRes.statusCode ) ;
        res.send( uacRes.statusCode, {
            headers: {
                'content-type': uacRes.get('content-type').type
            }
            ,body: uacRes.body
        }) ;
    }) ;
}) ;

app.on('sipdialog:create', function(e) {
    var dialog = e.target ;

    debug('sipdialog:create handler for dialog with id %s', dialog.dialogID) ;
})
.on('sipdialog:terminate', function(e) {
    var dialog = e.target ;
    
    debug('dialog with role %s and dialogID %s was terminated due to %s', dialog.role, dialog.dialogID, e.reason ) ;
/*
    dialog.sessionStore.get( dialog.call_id, function( err, otherCallId){
        if( err ) throw( err ) ;
        debug('matching callid we need to send BYE on is %s', otherCallId) ;

        SipDialog.loadFromSessionStore( dialog.sessionStore, otherCallId, dialog.role === 'uac' ? 'uas': 'uac', function( err, dlg){
            if( err ) throw( err ) ;

            debug('terminating dialog ', dlg) ;
            dlg.terminate() ;
        })
    })
*/
}) ;





