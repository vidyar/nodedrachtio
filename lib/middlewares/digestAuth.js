var utils = require('../utils')
/**
 * Digest Auth:
 *
 * Enfore digest authentication by challenging REGISTER requests without credentials.
 * For register requests that do contain credentials, the attributes will be parsed
 * and added to the Authorization header for easy retrieval.
 * Optionally, an asycnhronous callback can be supplied to authenticate the user.
 *
 *  Simply reject REGISTER without Authorization header, 
 *  parse attributes from REGISTERs that contain Authorization header
 *
 *     app.use(drachtio.digestAuth('drachtio.com'));
 *
 *  Async callback authentication, accepting `fn(err, password)`.
 *
 *     app.use(drachtio.digestAuth('drachtio.com', function(realm, user, fn ){
 *         //...retrieve and provide password based on user and realm
 *         fn( err, password ) ;
 *     })) ;
 *
 * @param {Function|String} callback or username
 * @param {String} realm
 * @api public
 */

module.exports = function digestAuth(realm, callback) {
  if( 'string' !== typeof realm ) throw new Error('realm argument required') ;
  if( callback && callback.length !== 3 ) throw new Error('callback arity must be (realm, user, fn)') ;


  return function(req, res, next) {

    function fn( err, password ) {
      if( err ) return res.send(500) ;

      debug('password is %s, verifying...', password) ;
      
      //TODO: hash password and compare to response
      var matched = false ;
      //XXXX


      matched = true ;
      if( matched ) return next() ;

      res.send(403) ;
    }


    var authorization = req.headers.authorization;


    if (!authorization) return utils.unauthorized(res, realm, 401);

    authorization.forEach( function( auth ){
      auth.params.forEach( function(param) {
        var arr = param.split('=') ;
        auth[arr[0]] = arr[1].replace(/"/g,'') ;
       
      }) ;
    }) ;

    if( callback ) {
      return callback( authorization[0].realm, authorization[0].user, fn ) ;
    }
    next() ;
  }
};

