//------------------------------------
// POST javascript module
//  3/9/2017, g1
//    encapsulate an asynchronous HTTP post function for making API calls
//

var http = require("http");
var https = require("https");

var authToken = "";

var put = function(host,path,body){
	return postput(host,path,body,"PUT");
}
var post = function(host,path,body){
	return postput(host,path,body,"POST");
}

var postput = function(host,path,body,theMethod){
	var postPromise = new Promise(function(resolve,reject){
		var postContent = JSON.stringify(body);
		if( (authToken != "") ){
			path += (path.indexOf("?")>0) ? "&" : "?";
			path += "access_token=" + authToken;
		}
		
		var opt = {
			hostname : host,
			port : 443,
			path : path,
			method: theMethod,
			headers : {
				'content-type' : 'application/json',
				'content-length' : Buffer.byteLength(postContent)
			    }
		    };
		var req = https.request(opt, function (res) {
			var respBody = "";
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				respBody += chunk;
			});
			res.on('end',function(){
				if( (res.statusCode===200) || (res.statusCode===204) ){
					var s="";
					try{
						s = JSON.parse(respBody);
					}catch(e)
					{}
					resolve(s);
				} else {
					reject(respBody);
				}
			});
		});

		req.on('error', function(e){
			reject(e.message);
		});
		req.write(postContent);
		req.end();
	});
	return postPromise;	
}


var get = function(host,path){
	var getPromise = new Promise(function(resolve,reject){
		if( (authToken != "") ){
			path += (path.indexOf("?")>0) ? "&" : "?";
			path += "access_token=" + authToken;
		}

		var opt = {
			hostname : host,
			port : 443,
			path : path,
			method: "GET",
		    };
		
		var req = https.request(opt, function (res) {
			var respBody = "";
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				respBody += chunk;
			});
			res.on('end',function(){
				if(res.statusCode===200){
					resolve(JSON.parse(respBody));
				} else {
					reject(respBody);
				}
			});
		});

		req.on('error', function(e){
			reject(e.message);
		});
		req.end();
	});
	return getPromise;	
}

authorize = function(token){
	authToken = token;
}


module.exports.put = put;
module.exports.post = post;
module.exports.get = get;
module.exports.authorize = authorize;

