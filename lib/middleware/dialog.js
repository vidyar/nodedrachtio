/**
 * Dialog:
 *
 * Emit sip dialog events
 *
 *     app.use(drachtio.dialog());
 *
 */

var SipDialog = require('../sip/sipdialog')
,_ = require('underscore')
,debug = require('debug')('drachtio-client:dialog') ;

module.exports = function dialog() {
 
    return function(req, res, next) {

        debug('received req, source %s, method %s', req.source, req.method) ;

        /* must be called after drachtio.session */
        if( !req.sessionStore ) return next('drachtio.dialog() requires drachtio.session() middleware to be installed prior') ;
        
        if( req.isNewInvite() ) {
            if( req.source === 'network' ) {
                /* proxy res.send to create dialog when sending 200 OK to INVITE */
                var send = res.send ;
                res.send = function( code, status, opts ) {
     
                    if( 200 === code ) {
                        var dialog = new SipDialog( req, res ) ;

                        /* as a convenience, anything the user put into req.session will be copied into dialog.session */
                        _.extend( dialog.session, req.session ) ;

                        var msg = opts || {} ;
                        if( 'object' == typeof status ) msg = status ;
                        if( 'content-type' in msg.headers ) dialog.local['content-type'] = msg.headers['content-type'] ;
                        dialog.local.sdp = msg.body ;
                        dialog.save( req.sessionStore ) ;
                    }
                    send( code, status, opts ) ;
                }
            }
            else {
                debug('status code on response: %d', res.statusCode) ;
                if( 200 === res.statusCode ) {
                    /* we've sent the INVITE as a uac and now have received a 200 OK response */
                    var dialog = new SipDialog( req ) ;

                    dialog.setRemote( res ) ;
                    dialog.local['content-type'] = req.get('content-type').type ;
                    dialog.setConnectTime( res.time ) ;
                    dialog.state = SipDialog.STABLE ;
                    dialog.save( req.sessionStore ) ;
                    emit( 'sipdialog:create', {
                      target: dialog
                    }) ;
                }
            }
            return next() ;
        }

        function emit( event, opts ) {
          process.nextTick( function() {
            req.app.emit( event, opts) ;
          }) ;
        }

        /* retrieve dialog */
        var sid = 'dlg:' + req.dialogId ;
 
        debug('retrieving dialog using sid %s', sid) ;
        req.sessionStore.get(sid, function(err, data){
            if( err ) {
                debug('error retrieving dialog with sid %s: %s', sid, err) ;
                return next(err) ;
            }

            if( !data ) {
                debug('no session found for request with sid %s', sid) ;
            }
            else {
                var dialog = new SipDialog(data) ;
                Object.defineProperty( dialog, 'app', {value: req.app}) ;
                req.dialog = dialog ;

 
                /* emit events */
                switch( req.method ) {
                  case 'ACK':
                    if( dialog.state === SipDialog.PENDING ) {
                        if( req.source === 'network') {
                            dialog.setConnectTime( req.msg.time ); 
                            dialog.state = SipDialog.STABLE ;
                            dialog.local.tag = req.get('to').tag ;
                            emit( 'sipdialog:create', {
                              target: dialog
                            }) ;

                            /* there is no response to an ACK, so we need to save it ourselves */
                            dialog.save( req.sessionStore ) ;                            
                        }
                    }
                    break ;

                    case 'BYE':
                        dialog.setEndTime( req.msg.time ); 
                        dialog.state = SipDialog.TERMINATED ;
                        emit('sipdialog:terminate', {
                            target: dialog
                            ,reason: ('network' === req.source ? 'normal far end release' : 'normal near end release')
                          }) ;

                        dialog.destroy( req.sessionStore ) ;

                    break ;
                }
            }
            next() ;
        }) ;
    };
}