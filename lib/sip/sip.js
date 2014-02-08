var Agent = require('../agent') ;

/*TODO: .methods and .STATUS_CODES
..A collection of all the standard HTTP response status codes, and the short description of each. For example, http.STATUS_CODES[404] === 'Not Found'.


sip.createAgent(address, port, secret )
*/


var sip = exports = module.exports = {} ;


sip.createAgent= function( app ) {
	return new Agent( app ) ;
}


sip.methods = require('./methods');

