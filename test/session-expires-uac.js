var app = require('..')()
,siprequest = app.uac
,config = require('./fixtures/test-config')
,d = require('./fixtures/data')
,debug = require('debug')('drachtio:session-expires-uac') ;
 
app.connect( {
    host: 'localhost'
    ,port: 8023
    ,secret: 'cymru'
}) ;

app.once('connect', function() {

    siprequest('sip:234@127.0.0.1:5060',{
        headers:{
            'content-type': 'application/sdp'
            ,'session-expires': '90; refresher=uac'
        },
        body: d.dummySdp
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
                    return ;
                }
                onConnect( dlg ) ;
             }) ;
        }
    }) ;
}) ;

function onConnect( dlg ) {

    dlg.bye( onDialogBye ) ;

    setTimeout( function() {
        dlg.request('bye') ;
    }, 100 * 1000);

}
function onDialogBye( req, res ) {
    debug('called party hung up') ;
    app.disconnect() ;
}



