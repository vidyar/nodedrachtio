/**
 * Module dependencies
 */

exports = module.exports = Resource ;

/**
 * A Resource represents an object that needs to be persisted and retrieved from session storage with behaviors intact (i.e. re-hydration).
 * It is intended to be an abstract class, where sub-classes typically represent a resource of some kind that is acquired by an application 
 * from the drachtio framework or underlying network, often need to be released or closed by an application after usage, and need to be 
 * able to retrieved from different servers during their lifetime.  An example is the SipDialog class, and higher-level libraries may 
 * also implement concrete sub-classes.
 *
 * An object which inherits from Resource meet the following requirements:
 * 		1) Provide an identifier that is unique within all instances of the subclass
 * 		2) Call the Resource function with this identifier within its own constructor function
 * 		3) Have a constructor function that can take a single argument that is a hash of values
 * 		4) Provide a static <code>prefix</code> property that identifies a namespace for this subclass.
 *
 * The reason for requirement #3 is that when the object is retrieved from storage the constructor function
 * will be invoked with a hash of the data.  Regardless of whether other constructor patterns are supported as well, 
 * the constructor function must be able to reconstitute the object from a hash of values
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
		return (self.constructor.prefix || 'res:') + self._id;
	});

}
