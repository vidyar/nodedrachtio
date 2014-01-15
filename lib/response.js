var util = require('util')
,hat = require('hat')
,SipMessage = require('./sip/sipmessage')
,SipDialog = require('./sip/sipdialog')
,_ = require('underscore')
,helpers = require('./utils/callback-helpers')
,debug = require('debug')('drachtio:response');

module.exports = Response ;

function Response(agent, req){
	this.agent = agent ;
	this.headerSent = false ;

	if( req.type === 'request') {
		SipMessage.call(this, {}); 
		this.req = req ;
		this.source = 'application' ;
	}
	else {
		SipMessage.call(this, req); 
		this.source = 'network' ;
	}
}

util.inherits(Response, SipMessage);

Response.prototype.setHeader = function( header, value ) {
	this.headers[header] = value ;
	return this; 
}
/**
 * Send a response.
 *
 * Examples:
 *
 *		res.send(486)
 * 		res.send( 486, 'Busy Here Right Now')
 *		res.send(500, {
 *			headers: {
 *				'Error-Info': 'Database down'
 *			}
 * 		})
 *     res.send(200, {
 *			body: {}
 * 			,headers: {}
 *		}, function( err, dlg) {
 * 	
 * 		});
 *
 * @param code
 * @param status
 * @param opts: headers and body
 * @param callbacks, only used in case of 200 
 * @return undefined
 * @api public
 */


Response.prototype.send = function( code, status, opts ) {
	var self = this ;
	if( !this.req ) throw new Error('cannot call send on a response that we have received') ;
	if( typeof code !== 'number' && 0 == this.statusCode ) throw new Error('must supply response code as first parameter to Response.send') ;

	if( this.req.method === 'CANCEL') {
		debug('sending response to incoming CANCELs is unnecessary, discarding..') ;//TODO: what about callbacks that might have been provided?
		return ;
	}

	var args = _.flatten( Array.prototype.slice.call( arguments ) );
	opts = opts || {} ;

	var cbStart = 3 ;
	if( 'object' == typeof status ) {
		opts = status ;
		status = undefined;
		cbStart-- ;
	}
	if( 'function' == typeof opts ) {
		opts = {} ;
		cbStart-- ;
	}

	/* add any supplied headers to this outgoing message, but not to any future response 
		(i.e. if set on a provisional they won't appear on the final response.
	*/
	var hdrs = {} ;
	opts.headers = opts.headers || {} ;
	_.each( opts.headers, function( value, key, list ) {
		hdrs[key] = value ;
	}) ;
	_.extend( hdrs, this.headers );
	opts.headers = hdrs ;

	/* move body into headers as a pseudo-header named 'payload' because drachtio/sofia wants it there */
	this.body = opts.body || this.body ;
	if( this.body ) {
		var body = Buffer.isBuffer(this.body)  ? this.body.toString('utf-8') : this.body ;
		opts.headers.payload = body ;
		delete opts['body'] ;
	}

	/* send request to drachtio to format and send the response */
	this.agent.sendNotify( 'respondToSipRequest', {
		transactionId: this.req.transactionId
		,code: code || this.statusCode
		,status: status
		,msg: opts
	}) ;
	if( code >= 200 ) {
		this.headerSent = true ;
		if( this.req.isNewInvite() ) {
			this.agent.removeCancelableTransaction( this.req.transactionId ) ;
		}
	}

	var callbacks = ((183 == code || 200 == code) && this.req.isNewInvite) ? _.flatten( args.slice( cbStart ) ) : [];

	/* add middleware to update some dialog properties based on the response */
	if( /*callbacks.length*/  (183 == code || 200 == code) && this.req.isNewInvite) {
		helpers.wrapFinalCallbackForRouter( callbacks ) ;
		callbacks.unshift( function( ack, dlg, next) {
			if( 'content-type' in opts.headers ) dlg.local['content-type'] = opts.headers['content-type'] ;
			next() ;
		}) ;

		var dialog = new SipDialog( this.req, this, callbacks ) ;
		this.agent.addDialog(this.req.transactionId, dialog) ;
	}

	if( code >= 200 ) {
		this.agent.clearTransaction( this.req.transactionId ) ;
	}
}

Response.prototype.ack = function( opts, callback ) {
	var self = this ;
	if( this.source !== 'network' || this.statusCode !== 200 || this.get('cseq').method !== 'INVITE' ) {
		throw new Error('Response.ack only valid for 200 OK responses to new INVITEs') ;
	}

	if( !this.dialog ) throw new Error('Response#ack - this.dialog does not exist'); 
	
	this.dialog.setRemote( this ) ;
	this.dialog.local['content-type'] = this.req.get('content-type').type ;
	this.dialog.setConnectTime( this.time ) ;
	this.dialog.state = SipDialog.STABLE ;

	if( typeof opts == 'function') {
		callback = opts ;
		opts = undefined;
	}

	//TODO: actually send an ack message if the INVITE had no SDP

	/* invoke the callback, providing the dialog object */
	process.nextTick( function() {
		callback.call( process.root, null, self.dialog ) ;
	}) ;

}


