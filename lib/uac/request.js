var util = require('util')
,debug = require('debug')('drachtio:uac:request')
,dispatchRequest = require('../utils/dispatch-request')
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

	this.init(options) ;
}

util.inherits( Request, EventEmitter) ;

Request.prototype.init = function (options) {

	var self = this 
	,app = this.agent.app ;

	options = options || {} ;
	options.msg = options.msg || {} ;
	options.msg.headers = options.msg.headers || {} ;

	if (!this.request_uri && !this.dialogId ) return this.emit('error', new Error('options.request_uri is a required argument')) ;

	//TODO: validate we have a valid sip request_request_uri here (or a host:[port], from which we can make a sip request_uri)

	this.headers = this.headers || {} ;

	//TODO: handle multipart bodies (lower priority)

	if (this.body && Buffer.isBuffer(this.body)) this.body = this.body.toString('utf8') ;

	if( this.headers ) _.extend( options.msg.headers, this.headers );
	if( this.body ) options.msg.body = this.body ;
	
	dispatchRequest( this.agent, options, this.callbacks ) ;

} 

Request.prototype.cancelRequest = function() {
	//TODO: need some way to cancel a request

	debug('canceling uac request, if not answered yet') ;

	return  ;
}