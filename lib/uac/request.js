var util = require('util')
,debug = require('debug')('drachtio:uac:request')
,dispatchRequest = require('../utils/dispatch-request')
,MultiKeySession = require('../middleware/session/multikeysession')
,EventEmitter = require('events').EventEmitter ;

module.exports = exports = Request ;

function Request( options ) {
	EventEmitter.call(this) ;

	options.method = options.method || 'INVITE' ;

	var reserved = Object.keys(Request.prototype) ;
	for (var i in options) {
		if (reserved.indexOf(i) === -1) {
			this[i] = options[i];
		} 
		else {
			if (typeof options[i] === 'function') {
				delete options[i] ;
			}
		}
	}
	delete options['agent'] ;
	delete options['callbacks'] ;

	if( 'session' in options ) {
		if( options.session instanceof MultiKeySession.SessionProto ) {
			Object.defineProperty(this,'mks', {value: options.session.mks}) ;
		}
		else throw new Error('Request: session object provided options is not an instanceof MultiKeySession.SessionProto') ;

		delete this['session'] ;
		delete options['session'] ;
	}

	this.init(options) ;
}

util.inherits( Request, EventEmitter) ;

Request.prototype.init = function (options) {

	var self = this 
	,app = this.agent.app ;

	options = options || {} ;
	options.msg = options.msg || {} ;
	options.msg.headers = options.msg.headers || {} ;

	if( this.request_uri || this.dialogId || (this.transactionId && this.method === 'CANCEL') ) {

		this.headers = this.headers || {} ;

		if (this.body && Buffer.isBuffer(this.body)) this.body = this.body.toString('utf8') ;

		if( this.headers ) _.extend( options.msg.headers, this.headers );
		if( this.body ) options.msg.body = this.body ;
		
		/**
		 * we may have no callbacks if the caller is going to pipe the output to a Response object, 
		 * in which case let the pipe method do the sending
		 */
		if( this.callbacks.length > 0 ) dispatchRequest( this.agent, this, options, this.callbacks ) ;
		else this.options = options ;

	}
	else {
		throw new Error('options.request_uri is a required argument') ;
	}
} 

Request.prototype.cancelRequest = function() {

	debug('canceling uac request, if not answered yet, the transactionId is %s', this.transactionId) ;

	if( this.transactionId ) {
		var options = {
			method: 'CANCEL'
			,transactionId: this.transactionId
		}
		dispatchRequest( this.agent, this, options, [] ) ; //no callbacks for this one
	}

	return  ;
}

Request.prototype.pipe = function( res, opts, cb ) {
	var Response = require('../response') ;
	if( !(res instanceof Response) ) throw new Error('Request#pipe: must supply res as first argument') ;
	
	if( typeof opts === 'function') {
		cb = opts ;
	}

	/* coalesce session with req.session */
	Object.defineProperty(this,'mks', {value:res.req.mks}) ;
	
	function callback( err, invite, uacRes ) {
      if( err ) throw( err ) ;
      	if( uacRes.statusCode >= 200 ) uacRes.ack( cb ) ;

        var headers = {} ;
        if( uacRes.statusCode === 200 ) headers['content-type'] = uacRes.get('content-type').type ;
        res.send( uacRes.statusCode, {
            headers: headers
            ,body: uacRes.body
        }) ;
 	}

	var options = this.options ;
	delete this[options] ;
	dispatchRequest( this.agent, this, options, [ callback ] ) ;
}