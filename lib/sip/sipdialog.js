var util = require('util')
,_ = require('underscore')
,Resource = require('../resource')
,uac = require('../uac')
,sipMethods = require('./methods') ;
//,EventEmitter = require('events').EventEmitter ;

exports = module.exports = SipDialog ;

var dialogStates = [] ;

['pending','early','stable','terminated'].forEach( function( state ){
	SipDialog[state.toUpperCase()] = state ;
	dialogStates.push( state ) ;
}) ;


SipDialog.UAC = 'uac' ;
SipDialog.UAS = 'uas' ;


/*

SipDialog( req, res); //when called as UAS

SipDialog( req ) ; //when called as UAC

SipDialog( hash ) ; //when instantiated from session store

*/
function SipDialog(req, res, callbacks) {
	var self = this ;
	this.__defineGetter__('dialogID', function(){
		return self.call_id + ';' + self.role ;
	});

	if( 1 === arguments.length  && req.method !== 'INVITE' ) {
		/* i.e., var x = new SipDialog( hash ); */
		_.extend( this, req ) ;
		Resource.call( this, this.dialogID ) ;
		return ;
	}
	
	if( req.method !== 'INVITE' ) throw new Error('SipDialog must be initialized with an INVITE request or a properties hash') ;

	/* these should not be enumerable / so it won't be persisted to session store  */
	Object.defineProperty( this, 'agent', {value: req.agent} ) ;
    Object.defineProperty( this, 'app', {value: req.app}) ;

	this.transactionId = req.transactionId ;
	this.local = {} ;
	this.remote = {} ;
	this.times = {
		start_time: req.msg.time 
	} ;
	this.state = SipDialog.PENDING ;

	callbacks = callbacks || [] ;

	var local, remote ;
	if( 1 == arguments.length ) {
		this.role = 'uac' ;
		local = req ;
	}
	else {
		this.role = 'uas' ;
		local = res ;
		remote = req ;

		/* set up our callbacks on receiving ACK, and add some middleware to set connect time */
		callbacks.unshift( function(ack, dlg, next){
    		this.times.connect_time = ack.msg.time ;
    		this.local.tag = ack.get('to').tag ;
    		this.state = ack.method === 'PRACK' ? SipDialog.EARLY : SipDialog.STABLE ;
    		next() ;
    	}) ;

    	/* bind the callbacks context to the SipDialog */
		Object.defineProperty(this, 'ackCallbacks', {value: _.map( callbacks, function( fn ){ return _.bind( fn, this ) ; }, this) });
	}

	this.call_id = req.get('call-id');
	var to = req.get('to') ;
	this.called_party = {
		user: to.url.user 
		,display: to.url.display
	} ;
	
	var cli = req.get('p_asserted_identify') || req.get('remote_party_id') || req.get('from') ;
	this.calling_party = {
		user: cli.url.user
		,display: cli.url.display
		,privacy: req.get('privacy')
	} ;

	this.local.sdp = local.body ;
	this.local.signaling_address = local.local_signaling_address ;
	this.local.signaling_port = local.local_signaling_port ;

	if( remote ) {
		_.extend( this.remote, {
			sdp: req.body
			,'content-type': req.get('content-type')
			,tag: req.get('from').tag
			,signaling_address: req.get('contact').url.host
			,signaling_port: req.get('contact').url.port
			,user: req.get('contact').url.user 
			,
		}) ;
	}

	Resource.call( this, this.dialogID ) ;
}
util.inherits(SipDialog,Resource);

SipDialog.prefix = 'dlg:' ;

SipDialog.prototype.setConnectTime = function( time ) {
	this.times.connect_time = time ;
}
SipDialog.prototype.setEndTime = function( time ) {
	this.times.end_time = time ;
}

SipDialog.prototype.setRemote = function( msg ) {
	_.extend( this.remote, {
		sdp: msg.body
		,'content-type' : msg.get('content-type').type 
		,tag: msg.get('to').tag
		,user: msg.get('contact').url.user
		,signaling_address: msg.get('contact').url.host
		,signaling_port: msg.get('contact').url.port || 5060
	}) ;
	this.local.tag = msg.get('from').tag ;
}

SipDialog.prototype.connect = function( req ) {
	var msg = req.msg ;

	if( req.method === 'ACK' ) {
		this.local.tag = req.get('to').url.tag ;
		this.times.connect_time = req.msg.time ;	
		this.state = SipDialog.STABLE ;
	}
}

SipDialog.prototype.request = function( method, opts, callbacks ) {
	var self = this ;
	var requestMethod = method.toLowerCase() ;

	if( typeof opts === 'function' ) callbacks = _.flatten( Array.prototype.slice.call( arguments, 1) );
	else callbacks = _.flatten( Array.prototype.slice.call( arguments, 2) );

	/* special stuff for bye */
	if( requestMethod === 'bye' ) {
		if( this.state === SipDialog.TERMINATED ) return ;
		this.state = SipDialog.TERMINATED ;

		/* middleware to set dialog end time when we get the response to our BYE */
		callbacks = callbacks || [] ;
		callbacks.unshift( function(req, res, next){
			this.times.end_time = res.time ;
			next() ;
		}) ;
	}

	var msg = { 
		dialogId: this.dialogID
		,msg: opts
		,session: this.session
	};

	/* set up callbacks so they are called in the context of the dialog object as 'this' */
	uac[requestMethod]( this.remote.signaling_address, msg, _.map( callbacks, function( fn) { return _.bind( fn, this ); }, this) ) ;
}

SipDialog.prototype.terminate = function(cb) {
	this.request('bye', function(err, req, res){
		if( cb ) {
			cb(err, req, res) ;
		}
	}) ;
}