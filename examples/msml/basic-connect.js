var app = require('../..')()
,siprequest = app.uac
,_=require('underscore')
,config = require('../test-config')
,debug = require('debug')('drachtio:msml-basic-connect') ;

var uacDlg, uasDlg ;

app.connect( config, function() { debug('connected');} ) ;

app.invite(function(req, res) {

    /* connect incoming call to the media server */

    siprequest('sip:msml@192.168.173.139',{
        headers:{
            'content-type': 'application/sdp'
        },
        body: req.body
    }, function( err, mreq, mres ) {

       if( mres.statusCode === 200 ) {

            mres.ack(function(err, dlg) {
                dlg.bye( onDialogBye) ;
                uacDlg = dlg ;
            }) ;

            req.active && res.send( 200, {
                headers: {
                    'content-type': 'application/sdp'
                }
                ,body: mres.body
            }, function( err, ack, dlg ) {
                dlg.bye( onDialogBye) ;
                uasDlg = dlg ;
            }) ;
        }
        else if( mres.statusCode > 200 ) {
            res.send( mres.status.code, mres.status.phrase ) ;
        }
    }) ;
}) ;

function onDialogBye( req, res ) {
    res.send(200) ;

    /* one side hung up - terminate the other side as well */
    (this === uacDlg ? uasDlg : uacDlg).request('bye') ;
}






