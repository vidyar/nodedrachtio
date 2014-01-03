# drachtio-client

[![Build Status](https://secure.travis-ci.org/davehorton/drachtio-client.png)](http://travis-ci.org/davehorton/drachtio-client)

drachtio-client is an application framework designed to let developers easily integrate [SIP](http://www.ietf.org/rfc/rfc3261.txt) call and media processing features into their applications.  It acts as a client to the [dractio](https://github.com/davehorton/drachtio) server platform, and offers [express](http://expressjs.com/)-style middleware for managing SIP requests.

###### Current status: early stage development/integration

## Quick start

The example below shows the basics of how to connect to drachtio and then send a SIP message. In this case, we are sending an OPTION message, e.g., to ping a remote SIP server.
```js
var drachtio = require('drachtio')
,app = drachtio()
,siprequest = app.uac ;

app.connect({host:'localhost', port: 8022, secret: 'cymru' }) ;

app.on('connect', function() {
	siprequest.options('sip:1234@192.168.173.139', function( err, req, res ) {
		if( err ) console.error( err ) ;
		else console.log('response status was ' + res.statusCode ) ;
	    app.disconnect() ;
	}) ;
}) ;
```
Adding sip headers to our message is easy:
```js
	//connect as before...
	siprequest.options('sip:1234@192.168.173.139', {
		headers:{
			'User-Agent': 'Drachtio rocksz'
			,'Server': 'drachtio 0.1'
			,'X-My-Special-thingy': 'isnt my custom header shiny pretty?'			
		}
	}, function( err, req, res ) {
		//....
	}) ;
```
As is adding a body, as shown below where we send an INFO message:
```js
	//connect as before...
	var myBody ; //populate as appropriate
	siprequest.info('sip:1234@192.168.173.139', {
		headers:{
			'Content-Type': 'application/text'
		}
		,body: myBody
	}, function( err, req, res ) {
		//....
	}) ;
```
Note that a Content-Length header is calculated automatically for you, so it is not necessary for the application to provide this.

### User Agent Server / User Agent Client

It is possible to build applications that act as a User Agent Server (UAS), or User Agent Client (UAC), or combine both in order to build a Back-to-Back User Agent (B2BUA) application.  We already saw examples of a UAC application above -- a SIP UAC is an application that generates outgoing SIP requests, whereas a SIP UAS is an application that receives incoming SIP requests.  Receiving incoming SIP requests is done using express-style app.VERB style:

```js
//connect as before...
app.register( function(req, res) {
    var expires = parseInt( req.get('contact').expires || req.get('expires').delta ) ;
    console.log('got a REGISTER request asking for a registration interval of ' + expires + ' seconds') ;
    res.send(200) ;
}) ;

```
In the above example, we handle incoming REGISTER requests and simply respond with a 200 OK after logging the Expires value requested in the REGISTER.

### Middleware

Express-style middleware can be used to intercept and filter messages.  Let's expand the example below to implement SIP Digest authentication on these incoming REGISTER requests:
```js
var drachtio = require('drachtio')
,app = drachtio()
,siprequest = app.uac ;

app.connect({host:'localhost', port: 8022, secret: 'cymru' }) ;

app.use('register', drachtio.digestAuth('dracht.io', function( realm, user, fn) {
    //here we simply return 'foobar' as password; real-world we'd hit a database or something..
    fn( null, 'foobar') ;
})) ;

app.register( function(req, res) {
    var expires = parseInt( req.get('contact').expires || req.get('expires').delta ) ;
    console.log('got a register request from an authenticated user with expires seconds ', expires) ;
    res.send(200) ;
}) ;
```
Now our app-level register route will only receive REGISTER requests that have been challenged and authenticated.  Incoming requests without credentials in an Authorization header will be rejected with a 401 and WWW-Authenticate header by the drachtio.digestAuth middleware, greatly simplifying the application.  Of course, you can add your own middleware in addition to the packaged SIP middleware that comes bundled with drachtio-client.

### Creating SIP Dialogs
Besides exchanging SIP requests and responses, your application can also create SIP dialogs by sending or receiving INVITEs.  A SIP dialog represents a long-lived connection between two endpoints over which media of some type is exchanged.  The SIP dialog is formed by means of the SIP INVITE request.  Once a dialog is formed, the application uses the dialog object to control and terminate the connection. This is done by using methods on the SipDialog object, and by establishing dialog-level routes (as opposed to application-level routes) to receive requests within a dialog.

Here is an example of a UAS application that establishes a dialog:
```js
app.invite(function(req, res) {

   req.cancel(function(creq, cres){
        console.log('the calling party hung up before we answered') ;
    }) ;

 	var sdp ; //populate as appropriate
        
    res.send(200, {
        headers: {
            'Content-Type': 'application/sdp'
        }
        ,body: sdp
    }, function( err, ack, dlg ) {

        if( err ) {
            console.error('error sending 200 OK to INVITE, ' + err) ;
            app.disconnect() ;
            return ;
        }
 
        console.log('SIP dialog has been established') ;

		//establish a dialog-level route to handle incoming BYE requests on this dialog
        dlg.bye(onDialogBye) ;
    }) ;
 }) ;

function onDialogBye( req, res ) {
    console.log('calling party hungup after we answered') ;
    res.send(200) ;
}
```
Establishing a dialog as a UAC is also possible:
```js
var drachtio = require('drachtio')
,app = drachtio()
,siprequest = app.uac ;

app.connect({host:'localhost', port: 8022, secret: 'cymru' }) ;
app.once('connect', function() {

    var sdp ; //populate as appropriate

    siprequest('sip:1234@localhost:59886',{
        headers:{
            'content-type': 'application/sdp'
        },
        body: sdp
    }, function( err, req, res ) {

        if( err ) {
            console.error('error sending invite: ' + err ) ;
            app.disconnect() ;
            return ;        
        }

        if( res.statusCode === 200 ) {

            res.ack(function(err, dlg) {

                if( err ) {
                    console.error('error sending ack: ' + err ) ;
                    app.disconnect() ;
                }
                else {
					console.log('dialog established'); 
                    dlg.bye( onDialogBye ) ;

                }
             }) ;
        }
    }) ;
}) ;

function onDialogBye( req, res ) {
    console.log('called party hung up') ;
    res.send(200) ;
}
```
### SIP Header Parsing
Note that headers are already pre-parsed for you in incoming requests, making it easy to retrieve specific information elements
```js
app.invite(function(req, res) {
	console.log('remote tag on the incoming INVITE is ' + req.get('from').tag ) ;
	console.log('calling party number on the incoming INVITE is ' + req.get('from').url.user) ;
```

## Documentation

TBD



