
/*!
 * Connect - session - Store
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  //, Session = require('./session') ;
 
/**
 * Initialize abstract `Store`.
 *
 * @api private
 */

var Store = module.exports = function Store(options){};

/**
 * Inherit from `EventEmitter.prototype`.
 */

Store.prototype.__proto__ = EventEmitter.prototype;

/**
 * Re-generate the given requests's session.
 *
 * @param {IncomingRequest} req
 * @return {Function} fn
 * @api public
 */

Store.prototype.regenerate = function(holder, fn){
  var self = this;
  this.destroy(holder.sessionID, function(err){
    self.generate(holder);
    fn(err);
  });
};

/**
 * Load a `Session` instance via the given `sid`
 * and invoke the callback `fn(err, sess)`.
 *
 * @param {String} sid
 * @param {Function} fn
 * @api public
 */

Store.prototype.load = function(sid, fn){
  var self = this;
  this.get(sid, function(err, sess){
    if (err) return fn(err);
    if (!sess) return fn();
    var holder = { sessionID: sid, sessionStore: self };
    sess = self.createSession(holder, sess);
    fn(null, sess);
  });
};

/**
 * Create session from JSON `sess` data.
 *
 * @param {IncomingRequest} req
 * @param {Object} sess
 * @return {Session}
 * @api private
 */

/*
Store.prototype.createSession = function(holder, sess){
  holder.session = new Session(holder, sess);
  return holder.session;
};
*/
