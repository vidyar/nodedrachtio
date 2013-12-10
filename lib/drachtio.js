var EventEmitter = require('events').EventEmitter
  , proto = require('./proto')
  , utils = require('./utils')
  , path = require('path')
  , basename = path.basename
  , uac = require('./uac')
  , debug = require('debug')('drachtio:drachtio')
  , fs = require('fs');


// expose createAgent() as the module

exports = module.exports = createAgent;


exports.version = '0.1.0';
exports.proto = proto;
exports.middleware = {};
exports.utils = utils;


function createAgent() {
  /* we may be called as either app( err, req, res ) or app( req, res ) */
  function app(err, req, res) { 2 == arguments.length ? app.handle(null, err, req): app.handle( err, req, res ); }
  utils.merge(app, proto);
  utils.merge(app, EventEmitter.prototype);
  app.route = '/';
  app.stack = [];

  for (var i = 0; i < arguments.length; ++i) {
    app.use(arguments[i]);
  }
  app.init();

  app.uac = uac ;

  debug('in createAgent app is ' + app)
  return app;
};

/**
 * Auto-load bundled middleware with getters.
 */

fs.readdirSync(__dirname + '/middlewares').forEach(function(filename){
  if (!/\.js$/.test(filename)) return;
  var name = basename(filename, '.js');
  function load(){ return require('./middleware/' + name); }
  exports.middleware.__defineGetter__(name, load);
  exports.__defineGetter__(name, load);
});
