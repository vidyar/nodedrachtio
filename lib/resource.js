/**
 * Module dependencies
 */
var _ = require('underscore') ;

exports = module.exports = Resource ;

/**
 * A Resource represents an object that needs to be persisted and retrieved from session storage with behaviors intact (i.e. re-hydration).
 * It is intended to be an abstract class, where sub-classes typically represent a resource of some kind that is acquired by an application 
 * from the drachtio framework or underlying network, often need to be released or closed by an application after usage, and need to be 
 * able to retrieved from different servers during their lifetime.  An example is the SipDialog class, and higher-level libraries may 
 * also implement concrete sub-classes.
 *
 * The only requirement for inheriting from Resource is to provide an identifier that is unique within all instances of the subclass, 
 * and to provide a static <code>prefix</code> property that identifies a namespace for this subclass.
 * 
 * @param {String} id - an identifier for the instance, unique within all instances of this type
 */
function Resource(id) {
	var self = this ;

	Object.defineProperty( this, '_id', {value: id} ) ;

	this.__defineGetter__('id', function(){
		return self._id;
	});
	this.__defineGetter__('sessionID', function(){
		return (self.constructor.prefix || 'res') + ':' + self._id;
	});
}
