
var OTP_config = {
	
	"osmMapKey": "conveyal.map-jc4m5i21",
	"aerialMapKey": "conveyal.map-a3mk3jug",

	"reverseGeocode": false,

	"metric": true,

	"siteTitle" : "Auckland Transport: Current Network vs Proposed Network",

	"scenarios": [
		{
			"id": "existing",
			"name": "Existing Network",
			"otpApi": "http://54.252.109.53:8001/otp-rest-servlet/ws",
			"color": "#800"
		},
		{
			"id": "proposed",
			"name": "Proposed Network",
			"otpApi": "http://54.252.109.53:8002/otp-rest-servlet/ws",
			"color": "#008"
		}
	] 
};
