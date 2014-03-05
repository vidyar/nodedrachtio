/**
 * @namespace utils/MultiKeySession
 */
 var uuid = require('node-uuid')
 ,Resource = require('../../resource')
 ,_ = require('underscore')
 ,async = require('async')
 ,crc16 = require('crc').crc16
 ,debug = require('debug')('drachtio:mksession') ;


function hash(sess) { 
	return crc16(JSON.stringify(sess, function(key, val){
		return val;
	}));
}

/**
 * A modules that exports a session store that can be retrieved by one or more keys
 * @module utils/MultiKeySession
 */
module.exports = MultiKeySession ;

MultiKeySession.resolvers = [Date] ;

const prefix = 'mks:' ;

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
	var drachtio = require('../../drachtio') ;
	var RedisStore = require('drachtio-redis')(drachtio) ;

	opts.ttl = opts.ttl || 86400 ;
	Object.defineProperty( this, '_store', {value: opts.store || new RedisStore(opts)} ) ;
	Object.defineProperty( this, '_client', {value: this._store.client}) ;

	this._uuid = opts.uuid ;

	if( !this._uuid ) {
		this._uuid = uuid.v1() ;
		this._keyData = {} ;
		this._session = new MultiKeySession.SessionProto(this) ;	
		this._session.mks = this ;
	}
	else {
		if(!opts.uuid || !opts.keyData || !opts.session ) {
			throw new Error('MultiKeySession: opts.uuid, .keyData and .session are required when retrieving MultiKeySession from storage') ;			
		}
		this._session = new MultiKeySession.SessionProto(this) ; 
		_.extend( this._session, opts.session ) ;

		['_uuid','_keyData'].forEach( function(prop) {
			self[prop] = opts[prop.slice(1)] ;
		}) ;
	}
	this._lastSavedHash = hash(this._session) ;

	['_store','_client','_uuid','_keyData','_session'].forEach( function(prop) {
		self.__defineGetter__(prop.slice(1), function(){
			return self[prop] ;
		});
	});

	/** this allows a user to do e.session = {foo: bar}; i.e. replacing the session object entirely */
	self.__defineSetter__('session', function(val) {
		val.__proto__ = SessionProto ;
		this._session = val ;
	}) ;

	self.__defineGetter__('keys', function(){
		return _.keys( this._keyData ) ;
	}) ;
}


/**
 * Adds a key to the MultiKeySession
 * @param {Resource|string} resource - Resource or a globally unique identifier for the key 
 *
 * @return {MultiKeySession} for chaining
 */
MultiKeySession.prototype.set = function( resource ) {

	var isUUID = !(resource instanceof Resource) ;

	var sid = isUUID ? prefix + resource : prefix + resource.sessionID ;

	this._keyData[sid] = {
		saved: false
		,resource: (isUUID ? null : resource)
	} ;
}

/**
 * get the resource identified by the globally unique identifier for the key
 * @param  {string} sessionID - unique key identifier
 * @return {Resource|undefined}           the resource to return
 */
MultiKeySession.prototype.get = function( sessionID ) {
	var sid = prefix + sessionID ;
	if( sid in this._keyData ) return this._keyData[sid].resource ;
}

/**
 * remove the specified key; if there are then no more keys, remove the underlying store
 * @param {Resource|string} resource - Resource or a globally unique identifier for the key 
* @return {MultiKeySession}           for chaining
 */
MultiKeySession.prototype.del = function( resource ) {
	var self = this ;

	var isUUID = !(resource instanceof Resource) ;

	var sid = isUUID ? prefix + resource : prefix + resource.sessionID ;

	debug('MultiKeySession#del: removing key %s', sid) ;
	if( sid in this._keyData ) {
		self._store.destroy( sid, function( err, keys ) {
			if( err ) throw(err) ;

			delete self._keyData[sid] ;
			debug('MultiKeySession#del: removed key %s, there are %d keys remaining', sid, _.size(self._keyData)) ;

			if( 0 === _.size( self._keyData ) ) {
				self._store.destroy( self._uuid, function( err, keys ) {
					if( err ) throw err ;
					debug('removed underlying session with uuid %s', self._uuid) ;
				}) ;
			}
		}) ;
	}
	return this ;
}

/**
 * return true if data has been modified since last save
 * @return {Boolean} true if data has been modified since saved
 */
MultiKeySession.prototype.isDirty = function(){

	/* have any keys been modified ? */
	if( _.find( _.values(this._keyData), function( kd ) { return false === kd.saved ; })) {
		debug('MultiKeySession#isDirty: keys have been modified')
		return true ;
	}

	/* has session been modified */
	var now = hash(this._session) ;
	debug('MultiKeySession#isDirty: current hash %d, previous was %d', now, this._lastSavedHash) ;
	if( now !== this._lastSavedHash ) {
		debug('MultiKeySession#isDirty: session data has been modified')
		return true ;
	}

	return false ;

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

	/* don't save if the object hasn't changed since last save */
	if( !this.isDirty() ) {
		debug('not saving mks, as it is not dirty') ;
		if( cb ) process.nextTick(function() { cb() ; }) ;
		return this ;
	}

	if( _.size( this._keyData ) === 0 ) throw new Error('MultiKeySession#save: no keys have been added') ;

	async.parallel([
		function saveKeys(callback){
			/* save any unsaved keys -- each has a value that is simply a reference to the MKS (uuid) */
			var array = [] ;
			_.each( self._keyData, function( obj, sessionID ) { array.push(_.extend({}, obj, {sessionID: sessionID})); }) ;
			async.each( array, function(key, cb) {
				if( true === key.saved ) return cb(null) ;
				self._store.set( key.sessionID, self.uuid, function(err, res) {
					if( err ) return cb(err) ;
					self._keyData[key.sessionID].saved = true ;
					cb(null) ;
				}) ;
			}
			,function( err ) {
				if( err ) return callback(err) ;
				callback(null) ;
			}) ;
		}
		, function saveMKS(callback) {
			/**
			 * save the MKS.  This consists of:
			 * 1) Saving the keys.  For each key, since we are going to need to re-hydrate it on load, we store
			 * the constructor name as well as the hash of data that will be fed to the constructor
			 * 
			 * 2) Saving the session data.  This is a plain javascript object, but we need to search through 
			 * that as well and save information about any objects in case we can re-hydrate them when we load.
			 * We also need to identify session objects that refer to the same object that we have as a key, 
			 * so we can re-hydrate those once/consistently.
			 */
			var mks = Object.create(null) ;
			mks.keys = {} ;
			_.each( self._keyData, function( obj, sessionID ){
				mks.keys[sessionID] = {} ;
				if( obj.resource ) {
					mks.keys[sessionID].constructorName = obj.resource.__proto__.constructor.name ;
					mks.keys[sessionID].instanceData = JSON.stringify( obj.resource );
				}
			}) ;

			mks.session = self._session ;

			/* prepare mks.session for re-hydration as well, of any embedded objects that have custom constructors */
			var liveSpecimens = {} ;

			/* ..being the opposite of hydrate */
			function dessicate( obj ) {
				if( _.isFunction(obj) ) return ;
				
				if( _.isArray( obj ) ) _.each( obj, function( el, idx ) { dessicate( el ) ; }) ;

				if( _.isObject( obj ) ) {
					_.each( obj, function( v, k, l) {
						if( _.isObject(v) && !_.isFunction(v) && v.__proto__ !== null && v.__proto__.constructor.name !== 'Object') {
							var instanceData = JSON.stringify(v) ;
							var h = hash(instanceData) ;
							liveSpecimens[h] = l[k] ;
							l[k] = {
								__constructorName__: v.__proto__.constructor.name
								,__instanceData__: instanceData
							}
						}
						else dessicate(v) ;
					}) ;
				}
				return ;
			}

			/**
			 * Once dessicated, we have changed the object in place; this restores it to its previous state
			 * so the caller doesn't get unanticipated side affects after saving
			 */

			function undessicate( obj ) {
				if( _.isFunction(obj) ) return ;
				if( _.isArray( obj ) ) _.each( obj, function( el, idx ) { undessicate( el ) ; }) ;

				if( _.isObject( obj ) ) {
					_.each( obj, function( v, k, l ) {
						if( _.isObject(v) && '__constructorName__' in v && '__instanceData__' in v ) {
							var h = hash(v['__instanceData__']) ;
							l[k] = liveSpecimens[h] ;
						} 
						else undessicate(v) ;
					}) ;
				}
			}

			var size = _.size( mks.session ) ;
			if( size > 0 ) dessicate(mks.session) ;
			self._store.set( self._uuid, mks ) ;
			if( size > 0 ) undessicate(mks.session) ;
			callback(null) ;
		}
		], function(err, results){
			if( err && cb ) return cb(err) ;

			self._lastSavedHash = hash(self._session) ;
			if( cb ) cb(null) ;
	}) ;

	return this ;
}


/**
 * Removes all data from the underlying storage
 * @param  {sessionCallback} cb - callback 
 */
MultiKeySession.prototype.destroy = function(cb) {
	var self = this ;

	/* remove the keys */
	var array = _.map( this._keyData, function( obj, sessionID ) {return _.extend({}, obj, {sessionID: sessionID});}) ;
	async.each( array, function(key, callback) {
		self._store.destroy( prefix + key.sessionID ) ;
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
MultiKeySession.loadFromStorage = function( opts, id, cb ) {

	var store = opts.store ||  new RedisStore(opts) ;
	var resolvers = _.uniq( (opts.resolvers || []).concat( MultiKeySession.resolvers ) );

	var resolverMap = {}
	resolvers.forEach( function( ctor ){
		resolverMap[ ctor.name ] = ctor ;
	}) ;

	function hydrate( obj ) {
		if( _.isFunction(obj) ) return ;
		
		if( _.isArray( obj ) ) _.each( obj, function( el, idx ) { hydrate( el ) ; }) ;

		if( _.isObject( obj ) ) {
			_.each( obj, function( v, k, l ) {
				if( _.isObject(v) && '__constructorName__' in v && '__instanceData__' in v ) {
					var object = JSON.parse( v['__instanceData__']);
					if( v['__constructorName__'] in resolverMap ) {
						var F = resolverMap[v['__constructorName__']] ;
						object = new F(object) ;
					}
					l[k] = object ;
				} 
				else hydrate(v) ;
			}) ;
		}
	}

	store.get( prefix + id, function(err, uuid) {
		if( err ) return cb(err) ;
		if( !uuid ) return cb('MultiKeySession.loadFromStorage: uuid not found for key: ' + (prefix + id)) ;

		var keyData = {} ;

		store.get( uuid, function( err, mks ) {
			if( err ) return cb(err) ;

			_.each( mks.keys, function( v, k ){
				/* re-hydrate the object, if we can */
				var F = v.constructorName in resolverMap ? resolverMap[v.constructorName] : null ;
				keyData[k] = {} ;
				if( v.instanceData ) {
					keyData[k].resource = F ? new F(JSON.parse(v.instanceData)) : JSON.parse(v.instanceData);
					keyData[k].saved = true ;
				}
			}) ;

			hydrate( mks.session ) ;

			var mks =  new MultiKeySession({
				keyData: keyData
				,session: mks.session
				,uuid: uuid
				,store: store
			}) ;

			/* for every object that inherits from Resource -- whether a key or session data -- attach mks */
			_.each( mks.keys, function( key ) {
				var obj = mks.keyData[key].resource ;
				if( obj instanceof Resource ) obj.attachSession(mks) ;
			}) ;

			function attachSession( obj ) {
				for( key in obj ) {
					if( obj[key] instanceof Resource ) obj[key].attachSession(mks) ;
					else if( typeof obj[key] === 'object' ) attachSession( obj[key]) ;
				}
			}

			attachSession( mks.session ) ;

			cb( null, mks) ;
		})
	}) ;
}

MultiKeySession.addResolvers = function( resolvers ) {
	MultiKeySession.resolvers = _.uniq( MultiKeySession.resolvers.concat( _.isArray(resolvers) ? resolvers : [ resolvers ] ) );
}



MultiKeySession.SessionProto = SessionProto ;

function SessionProto(mks) {
	Object.defineProperty(this,'mks',{
		get: function() { return mks; }
	}) ;
}

SessionProto.prototype.save = function(cb) {
	this.mks.save( cb ) ;
}



