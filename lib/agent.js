var util = require('util')
,EventEmitter = require('events').EventEmitter
,net = require('net')
,JsonSocket = require('json-socket')
,hat = require('hat')
,Request = require('./request')
,Response = require('./response')
,_ = require('underscore')
,debug = require('debug')('drachtio:agent');

module.exports = exports = Agent ;

function Agent(app){
	if (!(this instanceof Agent)) return new Agent(opts);

	EventEmitter.call(this); 

	this.app = app ;
	this.connected = false ;

	/* map of sip request methods to the associated routes invoked 
	when we receive a sip request outside of a dialog with that method */
	this.verbs = {} ;

	/* map of rid to the callback invoked when response is received */
	this.cbResponse = {} ;

	/* map of transaction id for outgoing (client-initiated) sip requests to the callback 
	   that is invoked when responses are received on that transaction */
	this.cbTransaction = {} ;

	/* map of stable dialogs by dialog id */
	this.dialogs = {} ;	

	/* map of transaction id to incoming invites in progress; 
	   i.e., sip dialogs that are in the process of being created */
	this.pendingDialogs = {} ;

	/* map of transaction id to incoming requests, where the request was an INVITE coming into us
	   which may be canceled 
	*/
	this.cancelableTransactions = {} ;
}

util.inherits(Agent, EventEmitter);

Agent.prototype.connect = function( opts, cb ) {
	debug('agent.connect, opts: ' + JSON.stringify(opts))
	var self = this ;
	if( 1 === arguments.length && _.isFunction( opts ) ) {
		cb = opts ;
		opts = {} ;
	}
	this.port = opts.port || 9022 ;
	this.host = opts.host  ;
	this.services = opts.services || []  ;
	this.secret = opts.secret  ;

	if( cb ) this.addListener('connect', cb) ;

	if( !opts.host ) {
		throw new Error('host not provided') ;
	}
	if( !opts.secret ) {
		throw new Error('secret not provided')  ;
	}

	this.socket = new JsonSocket(new net.Socket());
	this.socket.connect( this.port, this.host, function() {
		self.connected = true ;

		var requestId = self.sendRequest('auth', {
			secret: self.secret
		}) ;
		self.state = 'authenticating' ;
	}) ;

	this.socket.on('error', function(err){
		debug('got socket error: ' + err) ;
		console.log(util.inspect(err)) ;
		if(!self.connected && cb ) {
			cb(err) ;
		}
	}) ;

	this.socket.on('message', function(msg){
		debug('received: ' + JSON.stringify(msg)) ;
		switch(self.state) {
			case 'authenticating':
				if( !msg.data.authenticated ) {
					self.emit('connect', 'failed to authenticate: ' + msg.data.reason ) ;
				}
				else {
					debug('authenticated, emit connect')
					self.state = 'authenticated' ;
					self.emit('connect', {hostport: msg.data.hostport}) ;
					self.routeVerbs() ;
				}
				break ;

			case 'authenticated':
				self.handle(msg) ;
				break ;

			default:
				throw new Error('undefined state ' + self.state) ;
		}
	}) ;

	this.socket.on('close', function(){
		debug('connection closed') ;
		self.connected = false ;
		self.emit('disconnect') ;
	})
} ;

Agent.prototype.handle = function( msg ) {
	switch( msg.type ) {			
		case 'notify':
			switch( msg.command ) {
				case 'sip':
					/* change 'payload' property to 'body' */
					if( msg.data.message.payload ) {
						msg.data.message.body = msg.data.message.payload ;
						delete msg.data.message['payload'] ;
					}
					if( msg.data.message.request_uri ) {
						/* incoming sip request */
						var req = new Request( this, msg.data.transactionId, msg.data.dialogId, msg.data.message ) ;
						var res = new Response( this, req ) ;

						if( req.method === 'CANCEL' && req.transactionId in this.cancelableTransactions ) {
							var invite = this.cancelableTransactions[req.transactionId] ;
							invite.canceled = true ;
							this.removeCancelableTransaction( req.transactionId ) ;
						}

						this.app( req, res ) ;				

						if( req.isNewInvite() ) this.addCancelableTransaction( req.transactionId, req ) ;
														
					}
					else {
						/* incoming sip response */
						var transactionId = msg.data.transactionId ;
						if( transactionId in this.cbTransaction ) {
							debug('invoking request callback')
							this.cbTransaction[transactionId]( null, msg ) ;

							/* remove transaction callback once a final response is received */
							if( msg.statusCode >= 200 ) this.removeTransactionCallback( transactionId ) ;
						}
						else {
							debug('received response for unknown transaction id %s', transactionId) ;
						}
					}
				break ;

				case 'dialogCreated':
					debug('got dialogCreated for dialog %s, from transaction %s', msg.data.dialogId, msg.data.transactionId) ;
					if( msg.data.transactionId in this.pendingDialogs ) {
						var dialog = this.pendingDialogs[msg.data.transactionId] ;
						dialog.dialogId = msg.data.dialogId ;
						delete this.pendingDialogs[msg.data.transactionId] ;
						this.app._router.routeDialog( dialog ) ;
						debug('number of pending dialogs is now %d', _.size(this.pendingDialogs)) ;
					}
					else {
						debug('received dialogCreated with unknown transaction id %s ', msg.data.transactionId) ;
					}
				break ;

				case 'dialogDestroyed':
					debug('got dialogDestroyed for dialog %s', msg.data.dialogId) ;
					this._router.unrouteDialog( dialog ) ;
				break ;

				default:
					throw new Error('unknown notify command: ' + msg.command) ;
				break ;
			}
			break ;

		case 'request':
			throw new Error('unknown request command ' + msg.command) ;
			break ;

		case 'response':
			if( msg.rid in this.cbResponse ) {
				debug('found callback for response with rid %s', msg.rid) ;
				this.cbResponse[msg.rid]( null, msg.data ) ;
				delete this.cbResponse[msg.rid] ;

				return ;
			}

			/* check for response to route request */
			for( var verb in this.verbs ) {
				if( msg.rid === this.verbs[verb].rid ) {
					this.verbs[verb].ackowledged = true ;
					return ;
				}
			}
			throw new Error('error matching respond message with rid ' + msg.rid) ;
			break ;

		default:
			throw new Error('unknown msg type ' + msg.type) ;
			break ;
	}
}
Agent.prototype.addDialog = function( transactionId, dialog ) {
	this.pendingDialogs[transactionId] = dialog ;
	debug('addDialog, number of dialogs is now %d', _.size(this.pendingDialogs)) ;
}
Agent.prototype.disconnect = function( cb ) {
	if( !this.socket ) throw new Error('socket is not connected') ;
	this.socket.end() ;
}
Agent.prototype.clearTransaction = function( transactionId ) {
	delete this.cancelableTransactions[transactionId] ;
}

Agent.prototype.sendRequest = function( command, data, cbResponse ) {
	var rid = hat() ;
	this.socket.sendMessage({
		type: 'request'
		,command: command
		,rid: rid
		,data: data
	}) ;
	if( cbResponse ) {
		this.cbResponse[rid] = cbResponse ;
	}
	return rid ;
}

Agent.prototype.sendNotify = function( command, data ) {
	this.socket.sendMessage({
		type: 'notify'
		,command: command
		,data: data
	}) ;
	return  ;
}

Agent.prototype.sendResponse = function( rid, data ) {
	this.socket.sendMessage({
		type: 'response'
		,rid: rid
		,data: data
	}) ;
}

Agent.prototype.route = function( verb ) {
	if( verb in this.verbs ) throw new Error('duplicate route request for ' + verb) ;
	this.verbs[verb] = {
		sent: false
	} ;
	if( 'registered' !== this.state ) return ;
	
	this.routeVerbs() ;
}

Agent.prototype.routeVerbs = function() {
	for( var verb in this.verbs ) {
		if( this.verbs[verb].sent ) continue ;
		this.verbs[verb].sent = true ;
		this.verbs[verb].ackowledged = false ;
		this.verbs[verb].rid = this.sendRequest('route', {
			verb: verb
		}) ;
	}
}

Agent.prototype.addTransactionCallback = function( transactionId, callback ) {
	this.cbTransaction[transactionId] = callback ;
	debug('addTransactionCallback: there are now %d transactions being tracked', _.size(this.cbTransaction) ) ;
}
Agent.prototype.removeTransactionCallback = function( transactionId ) {
	delete this.cbTransaction[transactionId]  ;
	debug('removeTransactionCallback: there are now %d transactions being tracked', _.size(this.cbTransaction) ) ;
}

Agent.prototype.removeCancelableTransaction = function( transactionId ) {
	delete this.cancelableTransactions[transactionId] ;
	debug('after removing cancelable transaction, number of such transactions is now %d', _.size( this.cancelableTransactions) ) ;
}
Agent.prototype.addCancelableTransaction = function( transactionId, req ) {
	this.cancelableTransactions[transactionId] = req ;
	debug('after adding cancelable transaction, number of such transactions is now %d', _.size( this.cancelableTransactions) ) ;
}