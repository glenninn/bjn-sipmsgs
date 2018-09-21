var auth = require("./auth.js");
var outdial = require("./makeoutdial.js");

// --------------------------------------------------------------
// ------------ Handle Command Line Interactions ----------------
if(process.argv.length <6)
	doHelp();

function doHelp()
{
console.log("Usage: one of the following command line instructions:");
	console.log("node sipmsgs.js ?     --- this help");
	console.log("node sipmsgs.js s <numeric_meeting_id> <moderator_passcode> <uri>");
	console.log("node sipmsgs.js p <numeric_meeting_id> <moderator_passcode> <cc> <phnum>");
	console.log("Utility application to perform outdial and display event status messages");
	console.log(" Where the command line parameters are:");
	console.log("    s | p              --- a character, 's' or 'p' to designate SIP or PSTN outdial");
	console.log("    numeric_meeting_id --- the string value you enter when joining from a client");
	console.log("    moderator_passcode --- the Moderator-enabling passcode for the specified meeting");
	console.log("    uri                --- the URI to place the SIP call");
	console.log("    cc   phnum         --- the country code and phonenumber for the PSTN call");
    process.exit(1);
}

//--------------- PSTN specific outdial parameters
//
var countryCode = "";
var phoneNumber = "";

//--------------- SIP specific outdial parameters
//
var uri = "";



var SipOrPstn        = "";
var meeting_id       = process.argv[3];
var attendeePasscode = process.argv[4];



switch(process.argv[2]){
	case 's' :
	case 'S' :
		SipOrPstn = "sip";
		uri = process.argv[5];
	break;
	case 'p' :
	case 'P' :
		SipOrPstn = "pstn";
		countryCode = process.argv[5];
		phoneNumber = process.argv[6];
	break;
	case '?' : doHelp();
	default:
	break;
}



// --------------------------------------------------------------
// ----------- Load Open Source Libraries -----------------------
var _ = require('underscore');
var my = require('myclass');
var sockjs = require('sockjs-client');

var evtModule = require('./eventService');
var readline = require('readline');


// --------------------------------------------------------------
//                 Application Specific Handler 
//                 of BlueJeans Events 
// --------------------------------------------------------------

var handler =
{
    onMessage: function(event, eventData)
    {
		console.log("\nEVENT: " + event);
		
        if (event === 'meeting.register.error')
        {
            errMsg('Authentication Error: You probably have a bad access token or the meeting does not exist.');
            process.exit(1);
            return;
        }

        var self = this;
        var eventJson = JSON.parse(eventData.body);
        var eventType = eventJson.event; 

        // console.log("+++ HANDLER " + eventType + ": " + JSON.stringify(eventJson));
        // console.log("");
		console.log("EVENT-TYPE: " + eventType);
		if(eventType == "dialout.notification")
			console.log("json: " + JSON.stringify(eventJson,null,2));
		else {
			var s = JSON.stringify(eventJson,null,2);
			s =s.substring(0,16);
			console.log("json: " + s + "...(truncated)...");
		}
    }
};



var apiHost      = "api.bluejeans.com";


var oauthRec = {
	 grant_type :"meeting_passcode",
	 meetingNumericId : meeting_id,
	 meetingPasscode : attendeePasscode
};
var authPath = "/oauth2/token?Meeting";

//--------------- To get Started, create a Moderator Meeting Access Token -------------------
//
auth.post( apiHost, authPath,oauthRec).then(function(results){
	var access_token = results.access_token;
	var fields       = results.scope.meeting.meetingUri.split("/");
	var partition    = results.scope.partitionName;
	var user_id      = fields[3];
	
	var now = new Date();
	
	console.log("\n-->SIPMSGS run: " + now.toLocaleString() );
	console.log("Obtained Moderator Access Token: " + access_token);
	console.log("Testing on behalf of user:       " + user_id);
	
	outdial.apiHost( apiHost );

	// --------------------------------------------------------------
	// 				Instantiation of My Event Handler
	// --------------------------------------------------------------
	var myMeetingEvents = evtModule.eventService(_, my, sockjs);
	if (myMeetingEvents)
	{
		console.log("Attaching to Event Stream for: " + meeting_id);
		
		 var opts =
		 {
			'numeric_id': meeting_id,
			'access_token': access_token,
			'user' : {
				'full_name': '',
				'is_leader': true
			},
			'leader_id': user_id,
			'protocol': '2',
			'endpointType': 'commandCenter',
			'eventServiceUrl': 'https://bluejeans.com/' + partition + '/evt/v1/' + meeting_id
		};

		myMeetingEvents.setUpSocket(opts);
		myMeetingEvents.registerHandler(handler, 'meeting.register.error');   
		myMeetingEvents.registerHandler(handler, 'meeting.notification');   
	}
	if(SipOrPstn == "pstn") {
		console.log("Initiating PSTN outdial to: " + countryCode + " " +phoneNumber);
		outdial.makePSTNOutdial(access_token,user_id,meeting_id,  attendeePasscode, countryCode,phoneNumber)
	} else if(SipOrPstn == "sip") {
		console.log("Initiating SIP outdial to: " + uri);
		outdial.makeSIPOutdial (access_token,user_id,meeting_id,  uri);
	} else {
		Console.log("Unrecognized call mode");
		process.exit();
	}
	
    console.log("Waiting... press ^C to end");	
	kp();
	
},function(errors){
	var emsg = errors.replace(/\n/g,"\n  ");
	console.log("Error when accessing meeting:\n  " + emsg);
	process.exit();
});

function kp() {
	readline.emitKeypressEvents(process.stdin);
	process.stdin.setRawMode(true);	
	process.stdin.on('keypress', function (chunk, key) {
		switch(key.name)
		{
			case 'c':
				if (key.ctrl) {
					console.log("\n***done***");
					process.exit();
				}
				break;
			default:
				console.log("Unknown Key: " + JSON.stringify(key));
		}
	});
}

	
