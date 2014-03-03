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

        if( 'application' === req.source ) return next() ;

        /* must be called after drachtio.session */
        if( !req.sessionStore && req.source === 'network') return next('drachtio.dialog() requires drachtio.session() middleware to be installed prior') ;
       
        if( req.isNewInvite() ) {
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
            return next() ;
        }

        /* retrieve dialog */
        var sid = SipDialog.prefix + req.dialogId ;
        var dialog = req.mks.get( sid ) ;
        if( !dialog ) {
            debug('dialog not found for id %s', sid);
            return next() ;
        }
        dialog.attachSession( req.mks ) ;
 
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
                e.emit( req.app, 'sipdialog:create') ;
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
                e.emit( req.app, 'sipdialog:create-early') ;
            }
            break ;

        case 'BYE':
            dialog.setEndTime( req.msg.time ); 
            dialog.state = SipDialog.TERMINATED ;
            var e = new Event( dialog, req.mks, 'network' === req.source ? 'normal far end release' : 'normal near end release' ) ;
            e.req = req ;
            e.res = res ;
            e.emit( req.app, 'sipdialog:terminate') ;
            break ;
        }
        next() ;
    }
}