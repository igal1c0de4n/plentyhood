// Places -- client

Meteor.subscribe("directory");
Meteor.subscribe("places");

// If no place selected, select one.
Meteor.startup(function () {
  Deps.autorun(function () {
    if (! Session.get("selected")) {
      var place = Places.findOne();
      if (place)
        Session.set("selected", place._id);
    }
  });
  Meteor.call("getNodeEnv", function (error, result) {
    console.log("app environment: " + result);
  });
});

///////////////////////////////////////////////////////////////////////////////
// Place details sidebar

Template.details.place = function () {
  return Places.findOne(Session.get("selected"));
};

Template.details.anyPlaces = function () {
  return Places.find().count() > 0;
};

Template.details.creatorName = function () {
  var owner = Meteor.users.findOne(this.owner);
  if (owner._id === Meteor.userId())
    return "me";
  return displayName(owner);
};

Template.details.canRemove = function () {
  return this.owner === Meteor.userId() && attending(this) === 0;
};

Template.details.maybeChosen = function (what) {
  var myRsvp = _.find(this.rsvps, function (r) {
    return r.user === Meteor.userId();
  }) || {};

  return what == myRsvp.rsvp ? "chosen btn-inverse" : "";
};

Template.details.events({
  'click .rsvp_yes': function () {
    Meteor.call("rsvp", Session.get("selected"), "yes");
    return false;
  },
  'click .rsvp_maybe': function () {
    Meteor.call("rsvp", Session.get("selected"), "maybe");
    return false;
  },
  'click .rsvp_no': function () {
    Meteor.call("rsvp", Session.get("selected"), "no");
    return false;
  },
  'click .invite': function () {
    openInviteDialog();
    return false;
  },
  'click .remove': function () {
    Places.remove(this._id);
    return false;
  }
});

///////////////////////////////////////////////////////////////////////////////
// Place attendance widget

Template.attendance.rsvpName = function () {
  var user = Meteor.users.findOne(this.user);
  return displayName(user);
};

Template.attendance.outstandingInvitations = function () {
  var place = Places.findOne(this._id);
  return Meteor.users.find({$and: [
    {_id: {$in: place.invited}}, // they're invited
    {_id: {$nin: _.pluck(place.rsvps, 'user')}} // but haven't RSVP'd
  ]});
};

Template.attendance.invitationName = function () {
  return displayName(this);
};

Template.attendance.rsvpIs = function (what) {
  return this.rsvp === what;
};

Template.attendance.nobody = function () {
  return ! this.public && (this.rsvps.length + this.invited.length === 0);
};

Template.attendance.canInvite = function () {
  return ! this.public && this.owner === Meteor.userId();
};

///////////////////////////////////////////////////////////////////////////////
// Map display

Template.leafletMap.created = function() {
  var mapViewDefault = { 
    center: [37.35024, -121.95751], 
    zoom: 13 
  }; // santa clara :) TBD: replace with auto-locate

  console.log("template leafletMap created");
  Session.set('mapView', mapViewDefault);
  this.renderCount = 0;
};

Template.leafletMap.rendered = function() {

  var self = this;
  var last = {};

  console.log("render iteration " + this.renderCount);
  if (this.renderCount > 0) {
    console.log("workaround for leaflet rerender call #" + this.renderCount);
    return;
  }
  this.renderCount++;
  var view = Session.get('mapView');
  console.log("view: center=" + view.center.toString() + ",zoom=" + view.zoom +")");
  var llmap = L.map('leaflet-map', {maxZoom: 16, minZoom: 3, noWrap: true}).
    setView(view.center, view.zoom).
    locate({maximumAge : 1000 * 3600}).
    whenReady(function () { console.log("llmap ready!")});

  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution : 'Tiles: &copy; Esri, National Geographic'
  }).addTo(llmap);

  var selectedCircleStyle = {
    stroke: true,
    color: 'yellow',
    opacity: 1,
    radius: 15
  };
  var circleStyle = {
    stroke: true,
    color: 'green',
    fillColor: 'green',
    fillOpacity: 0.6,
    opacity: 0.2,
    radius: 10
  };

  llmap.on('moveend', function(e) {
    var view = {};
    view.center = llmap.getCenter();
    console.log('moveend: center=' + view.center.toString());
    Session.set('mapView', view);
  });

  llmap.on('click', function(e) {
    console.log('clicked at latlong: ' + e.latlng);

    // ctrl is meta key to add a new place
    if (e.originalEvent.ctrlKey === true) {
      if (! Meteor.userId()) {
        console.log("must be logged in to create events");
        return;
      }
      openCreateDialog(e.latlng.lat, e.latlng.lng);
    }
  });  

  // closure vars
  var circles = [];

  // control all markers via a single layer
  var markerLayer = L.layerGroup().addTo(llmap);
  var staticRoot = "https://s3.amazonaws.com/plentyhood/"
  var leafletStaticFolder = staticRoot + "leaflet/images/";
  var markerIcon = L.icon({
    iconUrl: leafletStaticFolder + "marker-icon.png",
    shadowUrl: leafletStaticFolder + "marker-shadow.png",
  });

  var markerUnselectedStyle = {
    icon: markerIcon,
    riseOnHover: true, 
    opacity: 0.5,
  };
  var markerSelectedStyle = {
    icon: markerIcon,
    riseOnHover: true,
  };

  function drawLocations() {

    // before redawing circles, delete the current ones
    // TBD optimization: update only the markers which change
    _.each(circles, function (c) {
      markerLayer.removeLayer(c);
    });
    var places = Places.find().fetch();
    circles = [];
    var selected = Session.get('selected');
    _.each(places, function (place) {
      var latlng = [place.lat, place.lng];

      var style = selected == place._id ? 
        markerSelectedStyle : markerUnselectedStyle;

      var circle = L.marker(latlng, style).addTo(markerLayer);
      circle.placeId = place._id;
      circle.on('click', function(e) {
        Session.set("selected", this.placeId);
      });
      circles.push(circle);
    });
  }

  this.handle = Deps.autorun(function () {
    var places = Places.find().fetch();
    var selected = Session.get('selected');
    var view = Session.get('mapView');

    var statStr = " locations=" + places.length +
                  " selected=" + selected;
    console.log("llmh: " + statStr);

    if (places.length == 0 || selected == last.selected) {
      console.log("llmh: skipping update." + statStr);
      return;
    }
    drawLocations();
  });
};

///////////////////////////////////////////////////////////////////////////////
// Create Place dialog

var openCreateDialog = function (lat, lng) {
  Session.set("createCoords", {lat: lat, lng: lng});
  Session.set("createError", null);
  Session.set("showCreateDialog", true);
};

Template.pageHeader.showCreateDialog = function () {
  return Session.get("showCreateDialog");
};

Template.createDialog.events({
  'click .save': function (event, template) {
    var title = template.find(".title").value;
    var description = template.find(".description").value;
    var public = ! template.find(".private").checked;
    var coords = Session.get("createCoords");

    if (title.length && description.length) {
      Meteor.call('createPlace', {
        title: title,
        description: description,
        lat: coords.lat,
        lng: coords.lng,
        public: public
      }, function (error, place) {
        if (! error) {
          Session.set("selected", place);
          if (! public && Meteor.users.find().count() > 1)
            openInviteDialog();
        }
      });
      Session.set("showCreateDialog", false);
    } else {
      Session.set("createError",
                  "It needs a title and a description, or why bother?");
    }
  },

  'click .cancel': function () {
    Session.set("showCreateDialog", false);
  }
});

Template.createDialog.error = function () {
  return Session.get("createError");
};

///////////////////////////////////////////////////////////////////////////////
// Invite dialog

var openInviteDialog = function () {
  Session.set("showInviteDialog", true);
};

Template.pageHeader.showInviteDialog = function () {
  return Session.get("showInviteDialog");
};

Template.inviteDialog.events({
  'click .invite': function (event, template) {
    Meteor.call('invite', Session.get("selected"), this._id);
  },
  'click .done': function (event, template) {
    Session.set("showInviteDialog", false);
    return false;
  }
});

Template.inviteDialog.uninvited = function () {
  var place = Places.findOne(Session.get("selected"));
  if (! place)
    return []; // place hasn't loaded yet
  return Meteor.users.find({$nor: [{_id: {$in: place.invited}},
                                   {_id: place.owner}]});
};

Template.inviteDialog.displayName = function () {
  return displayName(this);
};
