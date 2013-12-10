var helpers = {} ;

module.exports = helpers ;

helpers.wrapFinalCallbackForRouter = function( callbacks ) {
	var arity = callbacks[callbacks.length-1].length ;
	if( 3 === arity ) {
		var fn = callbacks.pop() ;
		callbacks.push( function( err, req, res, next ){ return fn( null, req, res );})
	}
}