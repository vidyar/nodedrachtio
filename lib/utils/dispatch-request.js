var helpers = require('./callback-helpers')
debug = require('debug')('drachtio:request-dispatcher') ;


/*
This function sends a sip request out the network (through drachtio) and sets it up so responses will gert funnelled up through 
middleware chain, ending by invoking the provided callbacks
*/
exports = module.exports = function( agent, uac, opts, callbacks ) {
	var app = agent.app ;

	/* have to do it this way to avoid circular dependency - Response depends on SipDialog, which depends on us */
	var Request = require('../request') ;
	var Response = require('../response') ;
	var SipDialog = require('../sip/sipdialog') ;

	process.nextTick( function() {
		agent.sendRequest( 'sendSipRequest', opts, function(err, msg){
			
			if( err ) {
				console.error('got error trying to send a sip request: ' + err) ;
				throw err ;
				//need to pass this error up the stack 
			}

			if( (msg.transactionId || !msg.success) && callbacks.length > 0 ) {


				/* if we have an error, we are going to call the final response callback, skipping any intermediate middleware */

				if( !err && !msg.success ) err = msg.reason ;
				
				if( err ) {
					if( 0 == callbacks.length ) {
						console.log('request rejected: ' + err);
						return ;
					}
					var fn = callbacks.pop() ;
					return fn( err, null, null );
				}

				/* if the final callback arity is 3 then wrap it so it becomes (err, req, res, next) - this is needed for router.js to dispatch to it */
				helpers.wrapFinalCallbackForRouter( callbacks ) ;

				/* install our response callbacks in the app Router */
				app.routeTransaction( msg.transactionId, callbacks) ;
				var req = new Request( agent, msg.transactionId, msg.message ) ;

				/* if this request will generate a dialog (i.e., it's a new INVITE) the setup the dialog in the router as well */
				var dlg ;
				if( !err && req.method === 'INVITE' && !req.get('to').url.tag ) {

					dlg = new SipDialog( req ) ;
					agent.addDialog( msg.transactionId, dlg) ;

					/* will enable the uac to cancel the transaction later, if desired */
					uac.transactionId = msg.transactionId ;
				}



				!err && agent.addTransactionCallback( msg.transactionId, function( err, msg ) {

					var res =  new Response( agent, msg.data.message );
					if( dlg ) res.dialog = dlg ;

					/* hack - sofia doesn't give us the via on the rqequest for some reason, so copy it over from response just so its there */
					req.headers['via'] = res.headers['via'] ;

					/* now invoke the middleware */
					app( req, res ) ;
				}) ;
			}
			else if( !msg.success ) {
				debug('got failure response: ', msg) ;
				//TODO: need to funnel this error up the middleware chain somehow
			}
		}) ;
	}) ;
}