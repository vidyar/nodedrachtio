
/**
 * Module dependencies.
 */


/**
 * Expose `Route`.
 */

module.exports = Route;

/**
 * Initialize `Route` with the given SIP `method`, `path`,
 * and an array of `callbacks` and `options`.
 *
 * Options:
 *
 *   - `sensitive`    enable case-sensitive routes
 *   - `strict`       enable strict matching for trailing slashes
 *
 * @param {String} method
 * @param {String} path
 * @param {Array} callbacks
 * @param {Object} options.
 * @api private
 */

function Route(method, callbacks) {
  this.method = method;
  this.callbacks = callbacks;
} 
