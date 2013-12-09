var app = require('../..')()
,siprequest = app.uac
,_=require('underscore')
,debug = require('debug')('drachtio:example-basic-play') ;

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

                dlg.info(onDialogInfo) ;
                dlg.bye(onDialogBye) ;

                uacDlg = dlg ;
            }) ;

            res.send( 200, {
                headers: {
                    'content-type': 'application/sdp'
                }
                ,body: mres.body
            }
            ,function( ack, dlg ) {
                dlg.bye(onDialogBye) ;
                uasDlg = dlg ;

                playFile() ;

            }) ;
        }
        else if( mres.statusCode > 200 ) {
            res.send( mres.status.code, mres.status.phrase ) ;
        }
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
    }, function( req, res ){
        debug('response to info message was: ', res.statusCode) ;
    }) ;
}

function onDialogInfo( req, res ) {
    debug('received INFO within a dialog ') ;
    res.send(200) ;
}
function onDialogBye( req, res ) {
    if( this === uasDlg ) {
        debug('received BYE on uas leg ') ;
        debug('uas times: ', this.times)
        debug('uas local: ', this.local)
        debug('uas remote: ', this.remote)
    
        uacDlg.request('bye',function() {
            debug('uac leg is now terminated') ;
            debug('uac times: ', this.times)
            debug('uac local: ', this.local)
            debug('uac remote: ', this.remote)
        }); 
    }
    else {
        uasDlg.request('bye') ;
    }
}



