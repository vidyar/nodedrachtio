var drachtio = require('../..')
,app = drachtio()
,siprequest = app.uac
,RedisStore = require('drachtio-redis')(drachtio) 
,d = require('../fixtures/data')
,SipDialog = drachtio.SipDialog 
,debug = require('debug')('drachtio:b2bua') ;

app.connect({
    host: '10.228.9.22'
    ,port: 8022
    ,secret: 'cymru'
}) ;

app.use( drachtio.session({store: new RedisStore({host: 'localhost', prefix:''})})) ;
app.use( drachtio.dialog() ) ;
app.use( app.router ) ;

app.invite(function(req, res) {
    siprequest( req.source_address + ':5060', {
        headers:{
            'content-type': 'application/sdp'
            ,subject: req.get('call-id')
        }
        ,body: req.body
        ,session: req.session
    })
    .pipe( res, function(err){
        if( err ) throw(err) ;
    }) ;
}) ;

app.on('sipdialog:create', function(e) {
    var dialog = e.target ;
    e.session[ (dialog.role === SipDialog.UAC ? 'uacLeg' : 'uasLeg')] = dialog ;
    e.session.save() ;
 })
.on('sipdialog:terminate', function(e) {
    var dialog = e.target ;
    e.session[(dialog.role === SipDialog.UAC ? 'uasLeg' : 'uacLeg')].terminate() ;
}) ;
