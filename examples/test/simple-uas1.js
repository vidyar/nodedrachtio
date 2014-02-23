var drachtio = require('../..')
,app = drachtio()
,RedisStore = require('drachtio-redis')(drachtio) 
,d = require('../fixtures/data')
,debug = require('debug')('drachtio:uas-delay-answer') ;

app.connect({
    host: 'localhost'
    ,port: 8022
    ,secret: 'cymru'
}) ;

app.use( drachtio.session({store: new RedisStore({host: 'localhost'}) }) ) ;
app.use( app.router ) ;

app.invite(function(req, res) {

    req.session = {
        user: 'daveh'
        ,cdr: {
            start: new Date()
            ,end: Object.create(null)
        }
    }

    res.send(200, {
        headers: {
            'content-type': 'application/sdp'
        }
        ,body: d.dummySdp
    }) ;

    req.cancel( function( req, res ){
        debug('request was canceled')
    }) ;
}) ;

app.bye(function(req,res){
    debug('on bye, session is ', req.session) ;
}) ;




