var app = require('..')()
,siprequest = app.uac
,config = require('./test-config')
,debug = require('debug')('drachtio:example-basic-uac') ;
 
app.connect( config ) ;

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
    }, function( err, ack, dlg ) {

        if( err ) {
            console.error('error sending 200 OK to INVITE, ' + err) ;
            app.disconnect() ;
            return ;
        }
 
        debug('dialog was connected: ',  dlg) ;

        dlg.bye(onDialogBye) ;

        setTimeout( function(){
            dlg.request('bye'/*, function(req,res){}*/) ;
        }, 3000)
    }) ;

 }) ;


function onDialogBye( req, res ) {
    debug('caller hungup') ;
    res.send(200) ;
}





