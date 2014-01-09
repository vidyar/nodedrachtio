var util = require('util')
,_ = require('underscore')
,uac = require('../uac')
,sipMethods = require('./methods')
,EventEmitter = require('events').EventEmitter ;

exports = module.exports = SipDialog ;

/* map of active sip dialogs */
var dialogs = {} ;

var dialogStates = [] ;

['pending','early','stable','terminated'].forEach( function( state ){
	SipDialog[state.toUpperCase()] = state ;
	dialogStates.push( state ) ;
}) ;

/*

SipDialog( req, res); //when called as UAS

SipDialog( req ) ; //when called as UAC



*/
function SipDialog(req, res, callbacks) {
	EventEmitter.call(this); 

	if( req.method !== 'INVITE' ) throw new Error('SipDialog must be initialized with an INVITE request') ;

	this.agent = req.agent ;
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

		/* set up our callbacks on receiving ACK/PRACK, and add some middleware to set connect time */
		callbacks.unshift( function(ack, dlg, next){
    		this.times.connect_time = ack.msg.time ;
    		this.local.tag = ack.get('to').tag ;
    		this.state = ack.method === 'PRACK' ? SipDialog.EARLY : SipDialog.STABLE ;
    		next() ;
    	}) ;

    	/* bind the callbacks context to the SipDialog */
		this.ackCallbacks = _.map( callbacks, function( fn ){ return _.bind( fn, this ) ; }, this) ;
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

	/* map of verbs to the callbacks to be invoked when we send a request of that verb within a dialog */
	this.mapRoutes = {} ;
}

util.inherits(SipDialog, EventEmitter);

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
		if( callbacks.length ) callbacks.unshift( function(req, res, next){
			this.times.end_time = res.time ;
			next() ;
		}) ;
	}

	var msg = { 
		dialogId: this.dialogId
		, msg: opts
	};

	/* set up callbacks so they are called in the context of the dialog object as 'this' */
	uac[requestMethod]( this.remote.signaling_address, msg, _.map( callbacks, function( fn) { return _.bind( fn, this ); }, this) ) ;
}

sipMethods.forEach(function(method){
	SipDialog.prototype[method] = function() {
		var callbacks = _.flatten( Array.prototype.slice.call(arguments) ) ;
		if( method === 'bye') {

			/* when handling bye, add some functionality for updating dialog -- add in some middleware to do the trick */
	    	callbacks.unshift( function(req, res, next){
	    		this.times.end_time = req.msg.time ;
	    		next() ;
	    	}) ;
		}

		/* ensure that these functions will be invoked in the context of the dialog as 'this' */
	    this.mapRoutes[method] = _.map( callbacks, function( fn ){ return _.bind( fn, this ) ; }, this) ;
		return this ;
	}
}) ;

