
module.exports = Event ;

function Event( target, mks, reason ) {
	var self = this ;

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

Event.prototype.saveSession = function( cb ) {
	this.mks.save( cb ) ;
}