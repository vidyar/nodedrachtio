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

	if( this.request_uri || this.dialogId || (this.transactionId && this.method === 'CANCEL') ) {

		this.headers = this.headers || {} ;

		if (this.body && Buffer.isBuffer(this.body)) this.body = this.body.toString('utf8') ;

		if( this.headers ) _.extend( options.msg.headers, this.headers );
		if( this.body ) options.msg.body = this.body ;
		
		dispatchRequest( this.agent, this, options, this.callbacks ) ;

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