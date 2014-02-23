var drachtio = require('..')
,app = drachtio()
,RedisStore = require('drachtio-redis')(drachtio) 
,siprequest = app.uac
,debug = require('debug')('drachtio:uac-with-session') ;
 
app.connect( {
    host: 'localhost'
    ,port: 8023
    ,secret: 'cymru'
}) ;

app.use( drachtio.session({store: new RedisStore({host: 'localhost'}) }) ) ;
app.use( drachtio.dialog() ) ;
app.use( app.router ) ;

app.once('connect', function() {

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

    siprequest('sip:234@127.0.0.1:5060',{
        headers:{
            'content-type': 'application/sdp'
            ,'supported': '100rel'
            ,'require': '100rel'
        },
        body: sdp
    }, function( err, req, res ) {

        if( err ) {
            console.error('error sending invite: ' + err ) ;
            app.disconnect() ;
            return ;        
        }

        if( res.statusCode === 200 ) {
            res.ack() ;
        }
    }) ;
}) ;


app.on('sipdialog:create', function(e) {
    var dialog = e.target ;
    debug('uac dialog was created: ', dialog) ;
    setTimeout( function() {
        debug('time to send bye') ;
        dialog.terminate() ;
    }, 3000) ;
})
.on('sipdialog:terminate', function(e) {
    var dialog = e.target ;
    
    debug('dialog was terminated due to %s', e.reason ) ;
 
    app.disconnect() ;
}) ;
