/**
 * @namespace utils/MultiKeySession
 */
 var uuid = require('node-uuid')
 ,Resource = require('../Resource')
 ,_ = require('underscore')
 ,async = require('async')
 ,debug = require('debug')('drachtio:mksession') ;

/**
 * A modules that exports a session store that can be retrieved by one or more keys
 * @module utils/MultiKeySession
 */
module.exports = MultiKeySession ;

/**
 * A MultiKeySession represents a collection of data elements that an application needs to persist between Javascript
 * callbacks, and which are related to each other from the standpoint of the application.  Each data element in the session
 * has a name and a value, and optionally may have a globally unique string identifier (GUID).  A MultiKeySession can be 
 * retrieved from the underlying storage by providing any one of the GUIDs in the data collection (hence, "multi-keyed").
 * <br/>
 * <br/>
 * An example use of a MultiKeySession would be for an application where for each caller a SipDialog, a MediaEndpoint, and some 
 * caller-specific identification are kept.  Upon the occurrence of an event on either the SipDialog, or the MediaEndpoint, 
 * the application may need to retrieve all the relevant data (for example, when a SipDialog is terminated, the application may 
 * want to act on the MediaEndpoint object in order to release it).  The MultiKeySession in this example would include 3 data elements; 
 * two of which would have GUIDs (the SipDialog and the MediaEndpoint), and one which would not (the user data). All data could be 
 * retrieved either by using the GUID of the SipDialog, or the MediaEndpoint.
 *
 * @constructor
 * @param {Object} opts 
 * @access public
 */
function MultiKeySession(opts) {
	var self = this;
	var drachtio = require('../drachtio') ;
	var RedisStore = require('drachtio-redis')(drachtio) ;

	opts.ttl = opts.ttl || 86400 ;
	this._store = opts.store || new RedisStore(opts) ;
	this._client = this._store.client ;
	this._uuid = opts.uuid ;

	if( !this._uuid ) {
		this._uuid = uuid.v1() ;
		this._keyData = {} ;
		this._session = Object.create(null) ;	//a plain object in which to store items
	}
	else {
		if(!opts.uuid || !opts.keyData || !opts.session ) {
			throw new Error('MultiKeySession: opts.uuid, .keyData and .session are required when retrieving MultiKeySession from storage') ;			
		}
		['_uuid','_keyData','_session'].forEach( function(prop) {
			self[prop] = opts[prop.slice(1)] ;
		}) ;

	}

	['_store','_client','_uuid','_keyData','_session'].forEach( function(prop) {
		self.__defineGetter__(prop.slice(1), function(){
			return self[prop] ;
		});
	});
}


/**
 * Adds an item to the MultiKeySession
 * @param {string} [id] - globally unique identifier for the item 
 * @param {string} name - name for the item; unique only within the MultiKeySession
 * @param {*} item - the item to be added
 *
 * @return {MultiKeySession} for chaining
 */
MultiKeySession.prototype.add = function( name, item ) {

	if( name in this._session ) throw new Error('MultiKeySession#add: an item with this name already has been added: ' + name ) ;

	if( item instanceof Resource ) {
		var sessionID = item.sessionID ;
		if( sessionID in this._keyData ) throw new Error('MultiKeySession#add: an item with this key has already has been added: ' + id) ;

		this._keyData[sessionID] = {
			saved: false
			,itemName: name
			,itemConstructor: item.__proto__.constructor.name
			,sessionUuid: this._uuid 
		} ;
	}

	this._session[name] = item ;
}

/**
 * This callback is invoked when a MultiKeySession is saved.
 *
 * @callback sessionCallback
 * @param {string} err - describes error, if any, or null otherwise
 * @param {string} res - response string
 */

/**
 * Saves the MultiKeySession to the underlying store
 * 
 * @param  {sessionCallback} [cb] - the callback that is invoked when the operation has completed
 * @return {MultiKeySession}      
 */		
MultiKeySession.prototype.save = function( cb ) {
	var self = this ;

	if( _.size( this._keyData ) === 0 ) throw new Error('MultiKeySession#save: no keys have been added') ;

	/* save any unsaved keys */
	_.each( this._keyData, function(keyData, sessionID, list) {
		if( false === keyData.saved ) {
			self._store.set( 'mks:' + sessionID, _.omit(keyData, 'saved'), function(err, res) {
				if( err ) throw err ;
				keyData.saved = true ;
			}) ;
		}
	}) ;

	/* save the session data, along with the keys */
	this._store.set( this._uuid, _.extend({}, this._session, {'__keys__': _.keys( this._keyData )}), cb) ;

	return this ;
}


/**
 * Removes all data from the underlying storage
 * @param  {sessionCallback} cb - callback 
 */
MultiKeySession.prototype.destroy = function(cb) {
	var self = this ;

	/* remove the keys */
	_.each( this._keyData, function(value, key, list) {
		self._store.destroy( value ) ;
	}) ;
	this._keyData = {} ;

	this._store.destroy( this._uuid, cb ) ;
}

/**
 * Removes all stored data and closes the client connection 
 * @param  {sessionCallback} cb - callback
 */
MultiKeySession.prototype.close = function( cb ) {
	var self = this ;
	this.destroy( function(err, res) {
		self._client.quit( cb ) ;
	}) ;
}

/**
 * This callback is invoked when a MultiKeySession is retrieved.
 *
 * @callback sessionRetrieveCallback
 * @param {string} err - describes error, if any, or null otherwise
 * @param {MultiKeySession} session - the MultiKeySession that was retrieved
 */

/**
 * @memberOf MultiKeySession
 * @static
 *
 * Retrieves a session given the GUID of any one of the data members
 *
 * @param {String} id - GUID of one of the data objects contained in the MultiKeySession
 * @param {sessionRetrieveCallback} cb - the callback that returns the MultiKeySession
 */
MultiKeySession.retrieve = function( opts, id, cb ) {

	var store = opts.store ||  new RedisStore(opts) ;

	store.get( 'mks:' + id, function(err, keyData) {
		if( err ) return cb(err) ;
		if( !keyData || !keyData.sessionUuid ) return cb('MultiKeySession.retrieve: identifier not found ') ;

		store.get( keyData.sessionUuid, function( err, data ) {
			if( err ) return cb(err) ;

			var kd = {} ;
			async.each( data['__keys__'], function( key, cb2) {
				store.get( 'mks:' + key, function( err, keyData ) {
					if( err ) return cb2( err ) ;
					kd[key] = keyData ;
					cb2() ;
				})
			}, function( err ) {
				if( err ) return cb(err) ;

				var mks = new MultiKeySession({
					store: store
					,uuid: keyData.sessionUuid
					,keyData: kd
					,session: _.omit( data, '__keys__')
				}) ;

				cb(null, mks) ;
			}) ;
		})
	}) ;
}




