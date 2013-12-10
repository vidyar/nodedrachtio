var app = require('../..')()
,siprequest = app.uac
,_=require('underscore')
,config = require('../test-config')
,debug = require('debug')('drachtio:msml-basic-connect') ;

var uacDlg, uasDlg ;

app.connect( config, function() { debug('connected');} ) ;

app.invite(function(req, res) {

    var r = siprequest('sip:msml@192.168.173.139',{
        headers:{
            'content-type': 'application/sdp'
        },
        body: req.body
    }, function( err, mreq, mres ) {

       if( mres.statusCode === 200 ) {

            mres.ack(function(err, dlg) {

                dlg.info(onDialogInfo) ;
                dlg.bye(onDialogBye) ;

                uacDlg = dlg ;

            }) ;

            req.active && res.send( 200, {
                headers: {
                    'content-type': 'application/sdp'
                }
                ,body: mres.body
            }
            ,function( err, ack, dlg ) {
                dlg.bye(onDialogBye) ;
                uasDlg = dlg ;

                playFile() ;

            }) ;
         }
        else if( mres.statusCode > 200 ) {
            res.send( mres.status.code, mres.status.phrase ) ;
        }
    }) ;

    /* if caller hangs up while we're connecting him, cancel our outbound request as well */
   req.cancel( function( creq, cres ){
        r.cancelRequest() ;
        cres.send(200) ;    
    }) ;

}) ;

function playFile() {

    var connection = 'conn:' + uacDlg.remote.tag ;
    debug('connection is %s', connection);
    var body = '<?xml version="1.0" encoding="US-ASCII"?>\n'+
        '<msml version="1.1">\n'+
        '<dialogstart target="' + connection + '" type="application/moml+xml" name="7">\n'+
        '<play cvd:barge="true" cvd:cleardb="false">\n'+
        '<audio uri="file://provisioned/4300.wav"/>\n'+
        '<playexit>\n'+
        '<send target="source" event="app.playdone" namelist="play.amt play.end"/>\n'+
        '</playexit>\n'+
        '</play>\n'+
        '<dtmf fdt="10s" idt="6s" edt="6s" cleardb="false">\n'+
        '<pattern digits="min=4;max=10;rtk=#" format="moml+digits"/>\n'+
        '<noinput/>\n'+
        '<nomatch/>\n'+
        '</dtmf>\n'+
        '<exit namelist="dtmf.digits dtmf.end"/>\n'+
        '</dialogstart>\n'+
        '</msml>\n' ;

    uacDlg.request('info', {
        headers: {
            'content-type': ' application/msml+xml'
        }
        ,body: body
    }, function( err, req, res ){
        debug('response to info message was: ', res.statusCode) ;
    }) ;
}

function onDialogInfo( req, res ) {
    debug('received INFO within a dialog ') ;
    res.send(200) ;
}
function onDialogBye( req, res ) {
    (this === uacDlg ? uasDlg : uacDlg).request('bye') ;
}



