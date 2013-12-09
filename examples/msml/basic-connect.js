var app = require('../..')()
,siprequest = app.uac
,_=require('underscore')
,debug = require('debug')('drachtio:example-basic-answer') ;

 app.set('port', 8022) ;
 app.set('host', 'localhost') ;
 app.set('secret', 'cymru') ;
 app.set('mrcf', 'msml') ;
 
 var uacDlg, uasDlg ;

app.connect( function(err){
	if( err ) console.log("Error connecting: " + err) ;
}) ;


app.invite(function(req, res) {

    siprequest('sip:msml@192.168.173.139',{
        headers:{
            'content-type': 'application/sdp'
        },
        body: req.body
    }, function( mreq, mres ) {

       if( mres.statusCode === 200 ) {

            mres.ack(function(dlg) {
                dlg.on('terminated', dialogTerminated) ;
                uacDlg = dlg ;
            }) ;

            res.send( 200, {
                headers: {
                    'content-type': 'application/sdp'
                }
                ,body: mres.body
            }, function( err, ack, dlg ) {
                dlg.on('terminated', dialogTerminated) ;
                uasDlg = dlg ;
            }) ;
        }
        else if( mres.statusCode > 200 ) {
            res.send( mres.status.code, mres.status.phrase ) ;
        }
    }) ;
}) ;

function dialogTerminated( reason ) {
    debug('dialog was terminated with reason %s', reason) ;
    if( this === uacDlg ) {
        uasDlg.terminate() ;
    }
    else {
        uacDlg.terminate() ;
    }
}






