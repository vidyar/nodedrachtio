var MultiKeySession = require('./middleware/session/multikeysession') ;

module.exports = Event ;

function Event( target, mks, reason ) {
	var self = this ;

	if( !(mks instanceof MultiKeySession) ) {
		throw new Error('Event constructor must be passed an instance of MultiKeySession') ;
	}

	this.target = target ;
	this.mks = mks ;
	this.reason = reason ;

	this.__defineGetter__('session', function(){
		return self.mks.session ;
	});
	this.__defineSetter__('session', function(val){
		self.mks.session = val ;
	});
}

Event.prototype.emit = function( app, name, cb ) {
	var self = this ;
	process.nextTick( function() {
		app.emit( name, self ) ;
		process.nextTick( function() {
			self.mks.save( function(err, res) {
				if( cb ) cb( err, res ) ;
			}) ;
		}) ;
	}) ;
}