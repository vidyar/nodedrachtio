var debug = require('debug')('drachtio:request-dispatcher') ;


/*
This function sends a sip request out the network (through drachtio) and sets it up so responses will gert funnelled up through 
middleware chain, ending by invoking the provided callbacks
*/
exports = module.exports = function( agent, opts, callbacks ) {
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
				//need to pass this error up the stack - but app() function doesn't seem to take err...
				//return options.callback( err ) ;
			}

			if( !msg.success ) {
				console.error('Error creating sip request: ' + msg.reason ) ;
				return ;
			}
			if( msg.success && msg.transactionId && callbacks.length > 0 ) {

				/* install our response callbacks in the app Router */
				app.routeTransaction( msg.transactionId, callbacks) ;
				var req = new Request( agent, msg.transactionId, msg.message ) ;

				/* if this request will generate a dialog (i.e., it's a new INVITE) the setup the dialog in the router as well */
				var dlg ;
				if( req.method === 'INVITE' && !req.get('to').url.tag ) {
					debug('just sent an INVITE that will create a new dialog') ;

					dlg = new SipDialog( req ) ;
					agent.addDialog( msg.transactionId, dlg) ;
				}



				agent.addTransactionCallback( msg.transactionId, function( err, msg ) {

					var res =  new Response( agent, msg.data.message );
					if( dlg ) res.dialog = dlg ;

					/* hack - sofia doesn't give us the via on the rqequest for some reason, so copy it over from response just so its there */
					req.headers['via'] = res.headers['via'] ;

					/* now invoke the middleware */
					app( req, res ) ;
				}) ;
			}
			else {
				debug('got failure response: ', msg) ;
				//TODO: need to funnel this error up the middleware chain somehow
			}
		}) ;
	}) ;
}