var MKSession = require('../../lib/middleware/session/multikeysession')
drachtio = require('../..')
,RedisStore = require('drachtio-redis')(drachtio) 
,uuid = require('node-uuid')
,async = require('async')
,assert = require('assert')
,Resource = require('../lib/Resource')
,util = require('util')
,debug = require('debug')('drachtio:test') ;


//var store = new RedisStore({host: 'localhost'}) ;

var session = new MKSession({
	//store: store
	host: 'localhost'
	,ttl: 60
	,prefix: ''
}) ;

var store = session.store ;

function Endpoint(opts) {
	Resource.call( this, opts ) ;

	this.codec = 'g711' ;
}
util.inherits(Endpoint, Resource);
Endpoint.prototype.hello = function() {debug('Endpoint says hello, this: ', this);}

Endpoint.prefix = 'ep' ;

var ep = new Endpoint( uuid.v1() ) ;

debug('Endpoint is a Resource? ', ep instanceof Resource) ;
return; 

var ep2 = new Endpoint( uuid.v1() ) ;

session.set( ep ) ;
session.set( ep2 ) ;
session.session = {
	user: 'daveh'
	,foo: 'bar'
	,baz: function() {}
	,ep: ep2 
	,myData: {
		endpoint: ep
		,hash: Object.create(null)
	}
} ;
session.save( function( err, res ) {
	if( err ) throw err ;

	MKSession.loadFromStorage({
		store: store
		,resolvers: [ Endpoint ]
	}, ep.sessionID, function(err, mks){
		if( err ) throw err ;

		debug('retrieved mks ', mks) ;
		debug('comparing to session ', session) ;

		debug('mks.session.ep.hello() ', mks.session.ep.hello()) ;
		debug('mks.session.myData.endpoint.hello() ', mks.session.myData.endpoint.hello()) ;

		session.close() ;
	}) ;
}) ;

return ;

