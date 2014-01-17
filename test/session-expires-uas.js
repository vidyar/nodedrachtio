var app = require('..')()
,siprequest = app.uac
,d = require('./fixtures/data')
,config = require('./fixtures/test-config')
,debug = require('debug')('drachtio:session-expires-uas') ;
 
app.connect( {
    host: 'localhost'
    ,port: 8022
    ,secret: 'cymru'
} ) ;

app.invite(function(req, res) {
        
    req.active && res.send(200, {
        headers: {
            'Content-Type': 'application/sdp'
            'Session-Expires': '90; refresher=uac'
        }
        ,body: d.dummySdp
    }, function( err, ack, dlg ) {

        if( err ) {
            console.error('error sending 200 OK to INVITE, ' + err) ;
            app.disconnect() ;
            return ;
        }
 
        dlg.bye(onDialogBye) ;

    });
}) ;


function onDialogBye( req, res ) {
    debug('caller hungup') ;
    res.send(200) ;
}





