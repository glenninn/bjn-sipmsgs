var auth = require("./auth.js");


var apiDialPstn  = function(userId,numericMeetingId){
	return "/v1/user/" + userId 
			 + "/live_meetings/" + numericMeetingId
			 + "/dialout/pstn";
}

var apiPairingCodeSIP = function(userId,numericMeetingId){
	return "/v1/user/" + userId 
			 + "/live_meetings/" + numericMeetingId
			 + "/pairing_code/SIP";
}

var apiPairingCodePSTN = function(userId,numericMeetingId){
	return "/v1/user/" + userId 
			 + "/live_meetings/" + numericMeetingId
			 + "/pairing_code/PSTN";
}

var apiHost = "";
var	countryCode = "";
var	phoneNumber = "";


function makePSTNOutdial(mtgAccess_token,userId,mtgId,accessCode,cc,phnum){
	console.log("*******************************************");
	console.log("** API Outdialing    (PSTN)              **");
	console.log("*******************************************");
		
	var pcRec = {
	endpointName : "Glenn PSTN",
	endpointType : "PSTN",
	capabilities : ["AUDIO"]
	};
	
	auth.authorize(mtgAccess_token);
	
	auth.post(apiHost,apiPairingCodePSTN(userId,mtgId),pcRec).then( (pcResults)=>{
		console.log("Acquired SIP Pairing Code:\n" + JSON.stringify( pcResults,null,2) );
		
		var dialRec = {
			// connectionGuid : pcResults.connectionGuid,
			pairedParticipantGuid : pcResults.seamEndpointGuid,
			phoneNumber : phnum,
			countryCode : cc
		};
		
		console.log("Making outdial: " + JSON.stringify(dialRec,null,2));			
		
		auth.post(apiHost,apiDialPstn(userId,mtgId),dialRec).then( (doResults)=>{
			console.log("Success making Dialout:\n" + JSON.stringify( doResults,null,2) );
		}, (doErrors)=>{
			console.log("Error making Dialout:" + doErrors);
		});

		
	}, (pcErrors)=>{
		console.log("Error getting Pairing Code:" + pcErrors);
	});
	
}


function makeSIPOutdial(mtgAccess_token,userId,mtgId,uriToCall){
	console.log("*******************************************");
	console.log("** API Outdialing    (SIP)               **");
	console.log("*******************************************");
	

	var pcRec = {
	endpointType : "GENERIC",
	endpointName : "testSOD",
	languageCode : "en",
	userId : 0
	};
	
	auth.authorize(mtgAccess_token);
	
	auth.post(apiHost,apiPairingCodeSIP(userId,mtgId),pcRec).then( (pcResults)=>{
		console.log("Acquired SIP Pairing Code:\n" + JSON.stringify( pcResults,null,2) );
		
		var dialRec = {
			// connectionGuid : pcResults.connectionGuid,
			// pairedParticipantGuid : pcResults.seamEndpointGuid,
			 uri : uriToCall
		};
		
		console.log("Making outdial: " + JSON.stringify(dialRec,null,2));			
		
		auth.post(apiHost,apiDialPstn(userId,mtgId),dialRec).then( (doResults)=>{
			console.log("Success making Dialout:\n" + JSON.stringify( doResults,null,2) );
		}, (doErrors)=>{
			console.log("Error making Dialout:" + doErrors);
		});

		
	}, (pcErrors)=>{
		console.log("Error getting Pairing Code:" + pcErrors);
	});
	
		
}

setApiHost = function(token){
	apiHost = token;
}



module.exports.makeSIPOutdial  = makeSIPOutdial;
module.exports.makePSTNOutdial = makePSTNOutdial;
module.exports.apiHost         = setApiHost;

