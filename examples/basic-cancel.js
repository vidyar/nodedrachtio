var app = require('..')()
,debug = require('debug')('drachtio:example-basic-answer') ;

 app.set('port', 8022) ;
 app.set('host', 'localhost') ;
 app.set('secret', 'cymru') ;
 app.set('mrcf', 'msml') ;
 
app.connect( function(err){
	if( err ) console.log("Error connecting: " + err) ;
}) ;


app.invite(function(req, res) {

    session = new Session() ;
   
    setTimeout( function() {
        res.send(500) ;
    }, 5000) ;

 }) ;


app.cancel(function(req,res){
    debug('received a cancel') ;
    res.send(200) ;

    session.end() ; 
}) ;


session.on('end', function(){

})
