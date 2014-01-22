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
            'content-type': 'application/sdp'
            ,'session-expires': '90; refresher=uas'
        }
        ,body: d.dummySdp
    }, function( err, ack, dlg ) {

        if( err ) {
            console.error('error sending 200 OK to INVITE, ' + err) ;
            app.disconnect() ;
            return ;
        }
        dlg.on('refresh', function() {
            debug('dialog was refreshed') ;
        })
        .on('terminate', function(reason) {
            debug('dialog was terminated due to %s', reason) ;
            app.disconnect() ;
        }) ;
    });
}) ;





