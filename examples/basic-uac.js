var app = require('..')()
,siprequest = app.uac
,debug = require('debug')('drachtio:example-basic-uac') ;

app.set('port', 8022) ;
app.set('host', 'localhost') ;
app.set('secret', 'cymru') ;
app.set('mrcf', 'msml') ;
 
app.connect( function(err){
	if( err ) throw err ;

    test() ;

}) ;

function test() {

    var sdp = 'v=0\n' +
        'o=- 1385064302543926 1 IN IP4 127.0.0.1\n' + 
        's=Bria 3 release 3.5.5 stamp 71243\n' + 
        'c=IN IP4 127.0.0.1\n' + 
        't=0 0\n' + 
        'm=audio 65000 RTP/AVP 123 121 9 0 8 18 101\n' + 
        'a=rtpmap:123 opus/48000/2\n' + 
        'a=fmtp:123 useinbandfec=1\n' + 
        'a=rtpmap:121 SILK/16000\n' + 
        'a=rtpmap:18 G729/8000\n' + 
        'a=fmtp:18 annexb=yes\n' + 
        'a=rtpmap:101 telephone-event/8000\n' + 
        'a=fmtp:101 0-15\n' + 
        'a=sendrecv\n' ;

    siprequest('sip:1234@localhost:19840',{
        headers:{
            'content-type': 'application/sdp'
        },
        body: sdp
    }, function( req, res ) {
        /* note: 
            req - representation of the actual request that was sent, can also be used to cancel the request, or examine any headers
            res - respponse
        */
        /* note: right now, error handling has to be done in middleware due to router requiring an arity of 4 if you want to handle errors */

        debug('via on req is ', res.get('via') ) ;
        debug('status is ', res.statusCode ) ;

        if( res.statusCode === 200 ) {
            res.ack(function(dlg) {
                debug('got dialog: ', dlg) ;

                setTimeout( function() {
                    debug('releasing dialog from our side') ;
                    dlg.terminate(function(req,res){
                        debug('sent a %s', req.method) ;
                        debug('got status %s on response', res.statusCode) ;
                    }); 
                }, 5000) ;

                dlg.on('terminated', dialogTerminated) ;
            }) ;
        }

    }) ;
}

function dialogTerminated( reason ) {
    debug('dialog was terminated with reason %s', reason) ;
}




