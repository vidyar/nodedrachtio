var helpers = {} ;

module.exports = helpers ;

helpers.wrapFinalCallbackForRouter = function( callbacks ) {
	if( callbacks.length && 3 === callbacks[callbacks.length-1].length ) {
		var fn = callbacks.pop() ;
		callbacks.push( function( err, req, res, next ){ return fn( null, req, res );})
	}
}