var _ = require('underscore') ;
/**
 * Create a new `Session` with the given object and `data`.
 *
 * @param {IncomingRequest} req
 * @param {Object} data
 * @api private
 */

var Session = module.exports = function Session(holder, data) {
  Object.defineProperty(this, 'holder', { value: holder });
  Object.defineProperty(this, 'id', { value: holder.sessionID });
  if ('object' == typeof data) _.extend(this, data);
};

/**
 * Save the session data with optional callback `fn(err)`.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.save = function(fn){
  this.holder.sessionStore.set(this.id, this, fn || function(){});
  return this;
};

/**
 * Re-loads the session data _without_ altering
 * the maxAge properties. Invokes the callback `fn(err)`,
 * after which time if no exception has occurred the
 * `req.session` property will be a new `Session` object,
 * although representing the same session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.reload = function(fn){
  var holder = this.holder
    , store = this.holder.sessionStore;
  store.get(this.id, function(err, sess){
    if (err) return fn(err);
    if (!sess) return fn(new Error('failed to load session'));
    store.createSession(holder, sess);
    fn();
  });
  return this;
};

/**
 * Destroy `this` session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.destroy = function(fn){
  delete this.holder.session;
  this.holder.sessionStore.destroy(this.id, fn);
  return this;
};

/**
 * Regenerate this request's session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.regenerate = function(fn){
  this.holder.sessionStore.regenerate(this.holder, fn);
  return this;
};
