
var MKSession = require('./session/multikeysession')
  , debug = require('debug')('drachtio:session')
  , MemoryStore = require('./session/memory')
  , Store = require('./session/store') 
  , SipDialog = require('../sip/sipdialog.js')
  , _ = require('underscore') ;
 
var env = process.env.NODE_ENV;

exports = module.exports = session ;

exports.Store = Store;
exports.Session = MKSession;
exports.MemoryStore = MemoryStore;

/**
 * Warning message for `MemoryStore` usage in production.
 */

var warning = 'Warning: connection.session() MemoryStore is not\n'
  + 'designed for a production environment, as it will leak\n'
  + 'memory, and will not scale past a single process.';

/**
 * Session:
 * 
 *   Setup session store with the given `options`.
 *
 *   Session data is _not_ saved in the cookie itself, however
 *   cookies are used, so we must use the [cookieParser()](cookieParser.html)
 *   middleware _before_ `session()`.
 *
 * Examples:
 *
 *     connect()
 *       .use(connect.cookieParser())
 *       .use(connect.session({ secret: 'keyboard cat', key: 'sid', cookie: { secure: true }}))
 *
 * Options:
 *
 *   - `key` cookie name defaulting to `connect.sid`
 *   - `store` session store instance
 *   - `secret` session cookie is signed with this secret to prevent tampering
 *   - `cookie` session cookie settings, defaulting to `{ path: '/', httpOnly: true, maxAge: null }`
 *   - `proxy` trust the reverse proxy when setting secure cookies (via "x-forwarded-proto")
 *
 * Cookie option:
 *
 *  By default `cookie.maxAge` is `null`, meaning no "expires" parameter is set
 *  so the cookie becomes a browser-session cookie. When the user closes the 
 *  browser the cookie (and session) will be removed.
 *
 * ## req.session
 *
 *  To store or access session data, simply use the request property `req.session`,
 *  which is (generally) serialized as JSON by the store, so nested objects 
 *  are typically fine. For example below is a user-specific view counter:
 *
 *       connect()
 *         .use(connect.favicon())
 *         .use(connect.cookieParser())
 *         .use(connect.session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }}))
 *         .use(function(req, res, next){
 *           var sess = req.session;
 *           if (sess.views) {
 *             res.setHeader('Content-Type', 'text/html');
 *             res.write('<p>views: ' + sess.views + '</p>');
 *             res.write('<p>expires in: ' + (sess.cookie.maxAge / 1000) + 's</p>');
 *             res.end();
 *             sess.views++;
 *           } else {
 *             sess.views = 1;
 *             res.end('welcome to the session demo. refresh!');
 *           }
 *         }
 *       )).listen(3000);
 *
 * ## Session#regenerate()
 *
 *  To regenerate the session simply invoke the method, once complete
 *  a new SID and `Session` instance will be initialized at `req.session`.
 *
 *      req.session.regenerate(function(err){
 *        // will have a new session here
 *      });
 *
 * ## Session#destroy()
 *
 *  Destroys the session, removing `req.session`, will be re-generated next request.
 *
 *      req.session.destroy(function(err){
 *        // cannot access session here
 *      });
 * 
 * ## Session#reload()
 *
 *  Reloads the session data.
 *
 *      req.session.reload(function(err){
 *        // session updated
 *      });
 *
 * ## Session#save()
 *
 *  Save the session.
 *
 *      req.session.save(function(err){
 *        // session saved
 *      });
 *
 * ## Session#touch()
 *
 *   Updates the `.maxAge` property. Typically this is
 *   not necessary to call, as the session middleware does this for you.
 *
 * ## Session#cookie
 *
 *  Each session has a unique cookie object accompany it. This allows
 *  you to alter the session cookie per visitor. For example we can
 *  set `req.session.cookie.expires` to `false` to enable the cookie
 *  to remain for only the duration of the user-agent.
 *
 * ## Session#maxAge
 *
 *  Alternatively `req.session.cookie.maxAge` will return the time
 *  remaining in milliseconds, which we may also re-assign a new value
 *  to adjust the `.expires` property appropriately. The following
 *  are essentially equivalent
 *
 *     var hour = 3600000;
 *     req.session.cookie.expires = new Date(Date.now() + hour);
 *     req.session.cookie.maxAge = hour;
 *
 * For example when `maxAge` is set to `60000` (one minute), and 30 seconds
 * has elapsed it will return `30000` until the current request has completed,
 * at which time `req.session.touch()` is called to reset `req.session.maxAge`
 * to its original value.
 *
 *     req.session.cookie.maxAge;
 *     // => 30000
 *
 * Session Store Implementation:
 *
 * Every session store _must_ implement the following methods
 *
 *    - `.get(sid, callback)`
 *    - `.set(sid, session, callback)`
 *    - `.destroy(sid, callback)`
 *
 * Recommended methods include, but are not limited to:
 *
 *    - `.length(callback)`
 *    - `.clear(callback)`
 *
 * For an example implementation view the [connect-redis](http://github.com/visionmedia/connect-redis) repo.
 *
 * @param {Object} options
 * @return {Function}
 * @api public
 */

function session(options){
  var options = options || {}
    , store = options.store || new MemoryStore
    , resolvers = _.uniq( (options.resolvers || []).concat( Date, SipDialog) )
    , storeReady = true;

    MKSession.addResolvers( (options.resolvers || []).concat([SipDialog]) ) ;

  // notify user that this store is not
  // meant for a production environment
  if ('production' == env && store instanceof MemoryStore) {
    console.warn(warning);
  }

  function attachSession( req, mks ) {
    Object.defineProperty( req, 'mks', {value:mks}) ;
    Object.defineProperty( req, 'session', {
      get: function() {
        return this.mks.session ;
      }
      ,set: function(val) {
        this.mks.session = val ;
      }
    }) ;
  }
  // generates the new session
  store.generate = function(req){
    if( req.mks ) return  ;
    var mks = req.mks || new MKSession({store:store, prefix:''}) ;
    mks.set( req.sessionID ) ;
    attachSession( req, mks ) ;
  };

  store.on('disconnect', function(){ storeReady = false; });
  store.on('connect', function(){ storeReady = true; });

  return function session(req, res, next) {

    debug('method: %s, source: %s, has session: %s, response source: %s, response status: %s', 
        req.method, req.source, req.hasOwnProperty('session'), res.source, res.statusCode ) ;

    // self-awareness
    if (req.session) {
      debug('already have req.session, continuing...') ;
      return next();
    }

    // Handle connection as if there is no session if
    // the store has temporarily disconnected etc
    if (!storeReady) return debug('store is disconnected'), next();

    // generate the session
    function generate() {
      store.generate(req);
    }

   // expose store
    req.sessionStore = store;
    req.resolvers = resolvers ;

    /**
     * perhaps should go like this:
     *
     * if source = application, reload the mks from storage (we will have a req.mks, but it may be old at this point)
     * if req.isNewInvite
     *     if source = network generate new session
     *     else if status == 200 add sip call id as key to mks
     *     return
     *  load session from storage
     *  if req.method == BYE
     *    if source = network proxy res.send to remove sip call-id as key
     *    else remove sip call-id as key
     *   
     */
    
    /* new INVITE */
    if( req.isNewInvite() ) {
      if( req.source === 'network' ) {
        generate() ;
      }
      else if( res.statusCode === 200 ) {
        debug('got 200 OK to uac INVITE, setting session key: %s', req.sessionID) ;
        req.mks.set( req.sessionID ) ;
      }
      req.mks.save( function(err){
        next() ;
      }) ;
      return ;
    }

    /* BYE */
    if( req.method === 'BYE' ) {
      if( req.source === 'network') {
        var send = _.bind( res.send, res );

        res.send = function( code, status, opts ) {
          res.send = send;
          debug('sending 200 OK to BYE, removing session key: %s', req.sessionID) ;
          req.mks.del( req.sessionID, function(){
            send(code, status, opts);
          }) ;
        }    
      }
      else {
        debug('received final response to BYE, removing session key: %s', req.sessionID) ;
        req.mks.del( req.sessionID, function() { 
          next(); 
        }) ;
        return ;
      }
    }

    //if( req.source === 'application' ) return next() ;

    /* load session from storage and attach to request */
    debug('fetching session for req.sessionID %s', req.sessionID);
    MKSession.loadFromStorage({store: store}, req.sessionID, function(err, mks) {
     // error handling
      if (err) {
        debug('error: ', err);
        if ('ENOENT' == err.code) {
          generate();
          next();
        } else {
          next(err);
        }
      // no session
      } else if (!mks) {
        debug('no session found');
        generate();
        next();
      // populate req.session
      } else {
        debug('loaded session from storage');
        attachSession( req, mks) ;
        next();
      }
    }) ;


    return ;




    //remove UAC call-id as session key when we get a response to a BYE
    if( req.source === 'application' && req.method === 'BYE') {
      req.mks.del( req.sessionID, function() {
        next() ;
      }) ;
      return ;
    }

    //for requests that we send, there is no point in retrieving the session state
    //we do, however, need to create a session object for new INVITEs that we send as UAC
    //so that a later request will have that session
    if( req.source === 'application' && !req.isNewInvite() ) return next() ;

    // Handle connection as if there is no session if
    // the store has temporarily disconnected etc
    if (!storeReady) return debug('store is disconnected'), next();

    // expose store
    req.sessionStore = store;
    req.resolvers = resolvers ;

    // proxy res.send() on UAS BYE to remove sip call id as session key
    if( 'network' === req.source && 'BYE' === req.method ) {
      var send = _.bind( res.send, res );

      res.send = function( code, status, opts ) {
        res.send = send;
        req.mks.del( req.sessionID, function(){
          send(code, status, opts);
        }) ;
      }    
    }
    else if( 'application' === req.source ) {
      /* add the sip call-id on a UAC leg to be a session key */
      req.mks.set( req.sessionID ) ;
      req.mks.save( function(err){
        return next() ;
      }) ;
      return ;
    }

    // generate the session for new INVITE requests that form a dialog
    if( req.isNewInvite() ) {
        debug('generating session for new incoming invite') ;
        generate();   
        req.mks.save( function(err){
          return next() ;
        }) ;
        return ;
   }
      //else if( 200 == res.statusCode ) {
      //  debug('generating session for 200 OK to INVITE') ;
      //  generate();     
      //}
      //return next();
    //}
    // generate the session object
    debug('fetching session for req.sessionID %s', req.sessionID);

    MKSession.loadFromStorage({store: store}, req.sessionID, function(err, mks) {
     // error handling
      if (err) {
        debug('error');
        if ('ENOENT' == err.code) {
          generate();
          next();
        } else {
          next(err);
        }
      // no session
      } else if (!mks) {
        debug('no session found');
        generate();
        next();
      // populate req.session
      } else {
        debug('session found');
        attachSession( req, mks) ;

        next();
      }
    }) ;
  };
};

/**
 * Hash the given `sess` object 
 *
 * @param {Object} sess
 * @return {String}
 * @api private
 */

function hash(sess) {
  return crc16(JSON.stringify(sess, function(key, val){
    return val;
  }));
}
