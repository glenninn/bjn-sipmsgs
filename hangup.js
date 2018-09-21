var auth = require("./auth.js");

if( (process.argv.length < 4) || (process.argv[2] == "?")) {
	console.log("Usage: node hangup.js  mtgId moderator_access_code");
	process.exit();
}


var mtgid = process.argv[2];
var axs   = process.argv[3];

var apiHost = "api.bluejeans.com";

var oauth = "/oauth2/token?Meeting";
var orec = {
  grant_type : "meeting_passcode",
  meetingNumericId : mtgid,
  meetingPasscode : axs
}

var api = "/v1/user/1442589/live_meetings/" + mtgid;
var endMtg = {
	status : "terminated"
};

function jsstr(s){
	return JSON.stringify(s,null,2);
}

auth.post(apiHost,oauth,orec).then(
	(success)=>{
		console.log("Authenticated... " + success.access_token);
		auth.authorize(success.access_token);
		auth.put(apiHost,api,endMtg).then(
			(ended)=>{
				console.log("Terminated the mtg: " + mtgid);
			},
			(failed)=>{
				console.log("Failed to end mtg: " + jsstr(failed));
			}
		);
	},
	(error)=>{
		console.log("Authentication error: " + error);
		process.exit();
	}
);