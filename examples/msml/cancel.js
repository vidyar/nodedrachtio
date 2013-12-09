var app = require('../..')()
,siprequest = app.uac
,_=require('underscore')
,debug = require('debug')('drachtio:example-100rel') ;

 app.set('port', 8022) ;
 app.set('host', 'localhost') ;
 app.set('secret', 'cymru') ;
 app.set('mrcf', 'msml') ;
 
 var uacDlg, uasDlg ;

app.connect( function(err){
	if( err ) console.log("Error connecting: " + err) ;
}) ;


app.invite(function(req, res) {

    var r = siprequest('sip:msml@192.168.173.139',{
        headers:{
            'content-type': 'application/sdp'
        },
        body: req.body
    }, function( mreq, mres ) {

       if( mres.statusCode === 200 ) {

            /* send ACK on B leg */
            mres.ack(function(dlg) {
                dlg.bye(onDialogBye) ;
                uacDlg = dlg ;
            }) ;

            res.send( 180 ) ;

            setTimeout( function(){
                 /* 200 OK on A leg with SDP of B */
                req.active && res.send( 200, {
                    headers: {
                        'content-type': 'application/sdp'
                    }
                    ,body: mres.body
                }
                ,function( ack, dlg ) {
                    dlg.bye(onDialogBye) ;
                    uasDlg = dlg ;
                }) ;
               
            }, 5000) ;

        }
        else if( mres.statusCode > 200 ) {
            res.send( mres.status.code, mres.status.phrase ) ;
        }
    }) ;

    req.cancel( function( creq, cres ){
        debug('INVITE was canceled') ;
        r.cancelRequest() ;
        cres.send(200) ;    //no need to do this, sofia handles it, and if called it will be silently disregarded
    })

}) ;

function onDialogBye( req, res ) {
    ( this === uasDlg ? uacDlg : uasDlg ).bye() ;
}



