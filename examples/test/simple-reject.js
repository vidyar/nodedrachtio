var drachtio = require('../..') ;
var app = drachtio() ;

app.connect({host:'localhost', port: 8022, secret: 'cymru'}) ;

app.use( app.router ) ;

app.invite( function( req, res ) {
    res.send(486, {
        headers: {
            'user-agent': "Drachtio rocksz - but he's busy right now!"
        }
    }) ;
}) ;
