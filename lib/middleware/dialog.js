/**
 * Dialog:
 *
 * Emit sip dialog events
 *
 *     app.use(drachtio.dialog());
 *
 */

var SipDialog = require('../sip/sipdialog')
Event = require('../event')
,_ = require('underscore')
,MKSession = require('./session/multikeysession')
,Resource = require('../resource')
,debug = require('debug')('drachtio:dialog') ;

const prefix = 'dlg:' ;

module.exports = function dialog() {
 
    return function(req, res, next) {

        debug('received req, source %s, method %s', req.source, req.method) ;

        if( 'application' === req.source && !req.isNewInvite() ) return next() ;

        /* must be called after drachtio.session */
        if( !req.sessionStore && req.source === 'network') return next('drachtio.dialog() requires drachtio.session() middleware to be installed prior') ;

        function emit( event, opts ) {
          process.nextTick( function() {
            req.app.emit( event, opts) ;
          }) ;
        }
        
        if( req.isNewInvite() ) {
            if( req.source === 'network' ) {
                /* proxy res.send to create dialog when sending 200 OK to INVITE */
                var send = _.bind(res.send, res) ;
                res.send = function( code, status, opts ) {
                    if( code >= 200 ) res.send = send ;
     
                    var reliable = false ;
                    if( code > 100 && code < 200 ) {
                        var msg = opts || status ;
                        var require = [] ;
                        if( msg.headers['require'] ) {
                            if( _.isArray(msg.headers['require']) ) {
                                require = _.flatten( msg.headers['require'] ) ;
                            }
                            else if( _.isString(msg.headers['require']) ) {
                                require = [ msg.headers['require'] ] ;
                            }
                        }
                        reliable = _.find( require, function(s) { return -1 !== s.indexOf('100rel');}) ;
                    }
                    if( 200 === code || reliable ) {
                        var dialog = new SipDialog( req, res ) ;
                        debug('dialog is a Resource? ', dialog instanceof Resource) ;

                        /* set dialog id as a key to the session */
                        req.mks.set( dialog ) ;

                        var msg = opts || {} ;
                        if( 'object' == typeof status ) msg = status ;
                        if( 'content-type' in msg.headers ) dialog.local['content-type'] = msg.headers['content-type'] ;
                        dialog.local.sdp = msg.body ;

                        req.mks.save(function(err){
                            return send( code, status, opts ) ;
                        }) ;
                    }
                    else send( code, status, opts ) ;
                }
            }
            else {
                debug('status code on response: %d', res.statusCode) ;
                if( 200 === res.statusCode ) {
                    /* we've sent the INVITE as a uac and now have received a 200 OK response */
                    var dialog = new SipDialog( req ) ;
                    req.mks = req.mks || new MKSession({store:req.sessionStore, prefix:''}) ;
                    req.mks.set( dialog ) ;

                    dialog.setRemote( res ) ;
                    dialog.local['content-type'] = req.get('content-type').type ;
                    dialog.setConnectTime( res.time ) ;
                    dialog.state = SipDialog.STABLE ;

                    req.mks.save( function(err) {
                        var e = new Event( dialog, req.mks ) ;
                        emit( 'sipdialog:create', e) ;
                    }) ;
                }
            }
            return next() ;
        }

        /* retrieve dialog */
        var sid = SipDialog.prefix + req.dialogId ;
        var dialog = req.mks.get( sid ) ;
        if( !dialog ) {
            debug('dialog not found for id %s', sid);
            return next() ;
        }
 
        /* we have a dialog, see if any of these messages represent dialog events we should emit */
        Object.defineProperty( dialog, 'app', {value: req.app}) ;
        Object.defineProperty( dialog, 'sessionStore', {value: req.sessionStore}) ;
        req.dialog = dialog ;

        switch( req.method ) {
        case 'ACK':
            if( (dialog.state === SipDialog.PENDING || dialog.state === SipDialog.EARLY) && req.source === 'network') {
                dialog.setConnectTime( req.msg.time ); 
                dialog.state = SipDialog.STABLE ;
                dialog.local.tag = req.get('to').tag ;
                var e = new Event( dialog, req.mks ) ;
                e.req = req ;
                e.res = res ;
                emit( 'sipdialog:create', e) ;
            }
            break ;

        case 'PRACK':
            if( (dialog.state === SipDialog.PENDING || dialog.state === SipDialog.EARLY) && req.source === 'network') {
                dialog.setConnectTime( req.msg.time ); 
                dialog.state = SipDialog.EARLY ;
                dialog.local.tag = req.get('to').tag ;
                var e = new Event( dialog, req.mks ) ;
                e.req = req ;
                e.res = res ;
                emit( 'sipdialog:create-early', e) ;
            }
            break ;

        case 'BYE':
            dialog.setEndTime( req.msg.time ); 
            dialog.state = SipDialog.TERMINATED ;
            var e = new Event( dialog, req.mks, 'network' === req.source ? 'normal far end release' : 'normal near end release' ) ;
            e.req = req ;
            e.res = res ;
            emit('sipdialog:terminate', e) ;
            break ;
        }
        next() ;
    }
}