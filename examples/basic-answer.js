var app = require('..')()
,debug = require('debug')('drachtio:example-basic-answer') ;

 app.set('port', 8022) ;
 app.set('host', 'localhost') ;
 app.set('secret', 'cymru') ;
 app.set('mrcf', 'msml') ;
 
app.connect( function(err){
	if( err ) console.log("Error connecting: " + err) ;
}) ;


app.invite(function(req, res) {

   req.cancel(function(creq, cres){
        debug('caller hung up') ;
    }) ;

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
        
	res.send(180) ;
    
    res.send(200, {
        headers: {
            'Content-Type': 'application/sdp'
        }
        ,body: sdp
    }, function( ack, dlg ) {
        //if( err ) throw( err ) ;
 
        debug('dialog was connected: ',  dlg) ;

        setTimeout( function(){
            dlg.request('bye', function(req,res){
                debug('received a response to our BYE message with status: ', res.statusCode) ;
                debug('cseq on our BYE was: ', req.headers['cseq'] ) ;
            }) ;
        }, 3000)
    }) ;

 }) ;






