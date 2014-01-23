var _ = require('underscore');
var L = require('leaflet');
var Handlebars = require('handlebars');
var Backbone = require('backbone');

var OTP = require('otp.js');
OTP.config = OTP_config;


$(document).ready(function() {
    new App();
});

function App() {

    $("#header").html(OTP.config.siteTitle);
    
    // initial scenario processing
    this.scenarios = {};
    for(var i=0; i < OTP.config.scenarios.length; i++) {
        var scenario = _.clone(OTP.config.scenarios[i]);

        // create the scenario container el and attach it to the main narrative container 
        scenario.el = $('<div>')
            .addClass('otpcompare-scenarioContainer')
            .appendTo($("#narrative"));

        this.scenarios[scenario.id] = scenario;
    }
        
    // set up the map
	this.map = L.map('map').setView([-36.840417, 174.739869], 13);
    this.map.attributionControl.setPrefix('');
    
	// add an OpenStreetMap tile layer
	var osmLayer = L.tileLayer('http://{s}.tiles.mapbox.com/v3/' + OTP.config.osmMapKey + '/{z}/{x}/{y}.png', {
        subdomains : ['a','b','c','d'],
	    attribution: 'Street Map: <a href="http://mapbox.com/about/maps">Terms & Feedback</a>'
	});
    
    var aerialLayer = L.tileLayer('http://{s}.tiles.mapbox.com/v3/' + OTP.config.aerialMapKey + '/{z}/{x}/{y}.png', {
        subdomains : ['a','b','c','d'],
        attribution : 'Satellite Map: <a href="http://mapbox.com/about/maps">Terms & Feedback</a>'
    });

    var baseLayers = {
        "Street Map" : osmLayer,
        "Satellite Map" : aerialLayer
    };
    L.control.layers(baseLayers).addTo(this.map);
    osmLayer.addTo(this.map);

    this.requestModel = new OTP.models.OtpPlanRequest();//{}, {urlRoot: OTP.config.otpApi + '/plan' }); 

    this.activeRequests = {}; // maps scenarioIds to OtpPlanRequest objects

    // remove the default change functionality
    this.requestModel.off('change');

    this.requestModel.on('change', _.bind(function() {

        for(scenarioId in this.scenarios) {

            var scenario = this.scenarios[scenarioId];

            // deactivate the previous response as needed:
            if(scenario.lastResponse && scenario.lastResponse.get("itineraries") && scenario.lastResponse.get("itineraries").activeItinerary) {
                scenario.lastResponse.get("itineraries").activeItinerary.trigger("deactivate");
            }                
            
            var scenarioRequest;
            if(scenarioId in this.activeRequests) {
                var activeRequest = this.activeRequests[scenarioId];
                activeRequest.off('success');
            }

            // set up the new request
            scenarioRequest = this.requestModel.clone();
            scenarioRequest.urlRoot = scenario.otpApi + '/plan';
            this.activeRequests[scenarioId] = scenarioRequest;

            scenarioRequest.request();
            scenarioRequest.on('success', _.bind(function(response) {
                this.app.scenarioResponse(this.scenario, response);
            }, {'app' : this, 'scenario' : scenario}));

            // show the "loading.." view
            if(scenarioRequest.get('fromPlace') && scenarioRequest.get('toPlace')) {
                this.hideOptions();
                scenario.el.html(scenarioSummaryLoadingTemplate({
                    scenario: scenario
                }));
            }
        }
    }, this));    

    
    // set up the request views (one for the form and one for the map)
    this.requestView = new OTP.request_views.OtpRequestFormView({
        model: this.requestModel,
        el: $('#request'),
        metric: OTP.config.metric
    });
    this.requestView.render();

    $('#request').find('.fromPlaceControl').hide();
    $('#request').find('.toPlaceControl').hide();
    $('#request').find('.arriveByControl').appendTo($('#request').find('.visibleSettings'));
    $('#request').find('.timeControl').appendTo($('#request').find('.visibleSettings'));
    
    this.requestMapView = new OTP.map_views.OtpRequestMapView({
    	model: this.requestModel,
    	map: this.map
    });
    this.requestMapView.render();


    
    $("#narrative").append(welcomeNarrativeTemplate());



    // set up the window resize functionality
    $(window).resize(_.bind(function() {
        this.resize();
    }, this));

    this.resize();
}

App.prototype.resize = function() {
    var height = $(window).height() - 50;
    $('#map').height(height);
    $('#sidebar').height(height);
    this.map.invalidateSize();
};

App.prototype.hideOptions = function() {
    if($('#hidableSettings').is(":visible")) {
        this.requestView.toggleSettings();
    }
    $("#narrative").find(".welcomeMessage").hide();
};

App.prototype.scenarioResponse  =function(scenario, response) {
    if(!scenario.view) {
        scenario.view = new ScenarioSummaryView({
            scenario : scenario,
            el: scenario.el,
            map: this.map
        });
    }
    scenario.view.newResponse(response);
    scenario.lastResponse = response;
};


/** ScenarioSummaryNarrativeView **/


Handlebars.registerHelper('formatSummaryDuration', function(d) {
    var str = OTP.utils.msToHrMin(d);
    str = str.replace(', ', ',<br/>');
    return new Handlebars.SafeString(str);
});


var welcomeNarrativeTemplate = Handlebars.compile([
    '<div class="messageWell well welcomeMessage">',
        '<p class="text-info">',
            'Select a start and end location by clicking the map, and use the form above to adjust trip settings.',
        '</p>',
    '</div>'
].join('\n'));

var scenarioSummaryLoadingTemplate = Handlebars.compile([
    '<div class="otpcompare-scenarioBox" style="border-color: {{scenario.color}};">',
        '<div class="otpcompare-scenarioHeader" style="background: {{scenario.color}};">',
            '{{scenario.name}}',
        '</div>',
        '<div style="padding: 5px; font-style: italic;">Loading...</div>', 
    '</div>'
].join('\n'));

var scenarioSummaryNarrativeTemplate = Handlebars.compile([
    '<div class="otpcompare-scenarioBox" style="border-color: {{scenario.color}};">',
        '<div class="otpcompare-scenarioHeader" style="background: {{scenario.color}};">',
            '{{scenario.name}}',
        '</div>',
        '<div style="position: relative; height: 75px;">',
            '<div style="position: absolute; left: 0px; top: 0px; bottom: 0px; width: 35%;">',
                '<div style="padding: 6px; font-size: 24px; font-weight:bold; line-height: 30px;">',
                    '{{formatSummaryDuration fullDuration}}',
                '</div>',
            '</div>',
            '<div style="position: absolute; right: 0px; top: 0px; bottom: 0px; width: 65%; padding: 6px;">',
                '<div style="text-align: center; height: 24px; margin-bottom: 6px; padding-top: 3px; overflow: hidden;">',
                    '{{#each itineraries.models.[0].attributes.legs.models}}',
                        '<nobr>',
                            '<div class="otp-legMode-icon otp-legMode-icon-{{attributes.mode}}"></div>',
                            '{{#unless @last}}',
                                '<div class="otp-legMode-icon otp-legMode-icon-arrow-right" style="margin: -2px -8px 0px -8px"></div>',
                            '{{/unless}}',   
                        '</nobr>',
                    '{{/each}}',
                '</div>',

                '<div class="row showDetails">', 
                    '<div class="col-sm-12">', 
                        '<button class="btn toggleDetails btn-default col-sm-12">Show Details <span class="glyphicon glyphicon-chevron-down"></span></button>',
                    '</div>',
                '</div>',
                '<div class="row hideDetails">', 
                    '<div class="col-sm-12">', 
                        '<button class="btn toggleDetails btn-default col-sm-12">Hide Details <span class="glyphicon glyphicon-chevron-up"></span></button>',
                    '</div>',
                '</div>',

            '</div>',
        '</div>',
        '<div style="padding: 8px;" class="details">',
            'details',
        '</div>',
    '</div>'
].join('\n'));

var ScenarioSummaryView = Backbone.View.extend({
 
    events: {
        "click .toggleDetails" : "toggleDetails"
    },

    initialize : function(options) {
        this.options = options || {};

        _.bindAll(this, "toggleDetails");

    },

    render : function() {
        var context = _.clone(this.model.attributes);
        context.scenario = this.options.scenario;
        var itineraries = this.model.get('itineraries');
        
        context.fullDuration = itineraries.at(0).getFullDuration(this.model.get('request'), this.model.getTimeOffset());

        this.$el.html(scenarioSummaryNarrativeTemplate(context));

        this.$el.find('.details').hide();
        this.$el.find('.hideDetails').hide();

        var responseView = this.responseView = new OTP.views.OtpPlanResponseView({
            narrative: this.$el.find('.details'),
            map: this.options.map,
            autoResize: false,
            legColor: this.options.scenario.color,
            metric: OTP.config.metric,
            showFullDuration: true
        });
        responseView.model = this.model;
        responseView.render();
        this.$el.find(".messageWell").hide();

    },

    newResponse : function(response) {

        this.model = response;
        this.render();
    },

    toggleDetails : function() {
        var details = this.$el.find('.details');

        if(details.is(":visible")) {
            details.slideUp("fast");
            this.$el.find('.showDetails').show();
            this.$el.find('.hideDetails').hide();
        }
        else {
            details.slideDown("fast");
            this.$el.find('.showDetails').hide();
            this.$el.find('.hideDetails').show();
        }
    },

});