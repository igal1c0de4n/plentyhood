Meteor.subscribe("directory");
Meteor.subscribe("places");
Meteor.subscribe("categories");
Meteor.subscribe("resources");
Meteor.subscribe("services");

Meteor.Router.add({
  '/admin': 'admin',
  '/': 'application',
  '*': '404'
});

// If no place selected, select one.
Meteor.startup(function () {
  Meteor.call("getNodeEnv", function (error, result) {
    console.log("app environment: " + result);
  });

  Deps.autorun(function () {
    if (! Session.get("selectedPlace")) {
      var place = Places.findOne();
      if (place)
        Session.set("selectedPlace", place._id);
    }
  });
});

///////////////////////////////////////////////////////////////////////////////
// Place details sidebar

Template.infoPanel.selectedPlace = function () {
  return Places.findOne(Session.get("selectedPlace"));
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
    Meteor.call("rsvp", Session.get("selectedPlace"), "yes");
    return false;
  },
  'click .rsvp_maybe': function () {
    Meteor.call("rsvp", Session.get("selectedPlace"), "maybe");
    return false;
  },
  'click .rsvp_no': function () {
    Meteor.call("rsvp", Session.get("selectedPlace"), "no");
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
// Map
///////////////////////////////////////////////////////////////////////////////

Template.leafletMap.created = function() {
  var mapViewDefault = { 
    latlng: [37.35024, -121.95751], 
    zoom: 13 
  }; // santa clara :) TBD: replace with auto-locate

  console.log("template leafletMap created");
  Session.set('mapView', mapViewDefault);
  this.renderCount = 0;
};

Template.leafletMap.rendered = function() {

  var self = this;
  var last = {};
  last.view = {};

  console.log("render iteration " + this.renderCount);
  if (this.renderCount > 0) {
    console.log("workaround for leaflet rerender call #" + this.renderCount);
    return;
  }
  this.renderCount++;
  var view = Session.get('mapView');
  console.log("view: latlng=" + view.latlng.toString() + ",zoom=" + view.zoom +")");
  var llmap = L.map('leaflet-map', {maxZoom: 16, minZoom: 3, noWrap: true}).
    setView(view.latlng, view.zoom).
    locate({maximumAge : 1000 * 60, setView: false}).
    whenReady(function () { console.log("leaflet ready")});

  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution : 'Tiles: &copy; Esri, National Geographic'
  }).addTo(llmap);

  llmap.on('moveend', function(e) {
    var view = {};
    view.zoom = llmap.getZoom();
    view.latlng = llmap.getCenter();
    console.log('moveend: latlng=' + view.latlng.toString());
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
      schedCreateDialog(e.latlng.lat, e.latlng.lng);
    }
  });  

  var userLocationMarker;

  llmap.on('locationfound', function(e) {
    var view = {};
    if (last.view.userLatlng != e.latlng) {
      if (userLocationMarker) {
        // remove previous user location circle
        llmap.removeLayer(userLocationMarker);
      }
      // mark user on the map with circle
      userLocationMarker = new L.CircleMarker(
        e.latlng, { color: 'yellow' /* for blue: '#15f'*/, 
          opacity: 0.9,
          fillOpacity: 0.6,
          radius: 10, 
          stroke: true});
      userLocationMarker.addTo(llmap);
      console.log("updated current location marker to " + e.latlng);
    }

    view.userLatlng = e.latlng;

    // pan the map to user location
    view.latlng = e.latlng;
    view.zoom = 15;

    console.log('locationfound: latlng=' + view.latlng.toString());
    Session.set('mapView', view);
  });

  llmap.on('locationerror', function(e) {
    console.log('locationerror: ' + e.message + " " + e.code);
  });

  // closure vars
  var markers = [];

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

    // before redawing markers, delete the current ones
    // TBD optimization: update only the markers which change
    _.each(markers, function (c) {
      markerLayer.removeLayer(c);
    });
    var places = Places.find().fetch();
    markers = [];
    var selected = Session.get('selectedPlace');
    last.selectedPlace = selected;
    _.each(places, function (place) {
      var latlng = [place.lat, place.lng];

      var style = selected == place._id ? 
        markerSelectedStyle : markerUnselectedStyle;

      var m = L.marker(latlng, style).addTo(markerLayer);
      m.placeId = place._id;
      m.on('click', function(e) {
        Session.set("selectedPlace", this.placeId);
      });
      markers.push(m);
    });
  }

  this.handle = Deps.autorun(function () {
    var places = Places.find().fetch();
    var selected = Session.get('selectedPlace');
    var view = Session.get('mapView');

    console.log("mapHandle: places=" + places.length +
                  " selected=" + selected);

    if (places.length == 0 || selected == last.selectedPlace) {
      console.log("mapHandle: skipping update");
      return;
    }
    if (!objectsEqual(last.view, view))
      llmap.setView(view.latlng, view.zoom);
    drawLocations();
    last.view = view;
  });
};

///////////////////////////////////////////////////////////////////////////////
// Create Place dialog

var schedCreateDialog = function (lat, lng) {
  Session.set("createCoords", {lat: lat, lng: lng});
  Session.set("createError", null);
  Session.set("showPlaceCreateDialog", true);
};

Template.placeCreateDialog.events({
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
          Session.set("selectedPlace", place);
          if (! public && Meteor.users.find().count() > 1)
            openInviteDialog();
        }
      });
      Session.set("showPlaceCreateDialog", false);
    } else {
      Session.set("createError",
                  "It needs a title and a description, or why bother?");
    }
  },

  'click .cancel': function () {
    Session.set("showPlaceCreateDialog", false);
  }
});

Template.placeCreateDialog.error = function () {
  return Session.get("createError");
};

///////////////////////////////////////////////////////////////////////////////
// Invite dialog

var openInviteDialog = function () {
  Session.set("showInviteDialog", true);
};

Template.inviteDialog.events({
  'click .invite': function (event, template) {
    Meteor.call('invite', Session.get("selectedPlace"), this._id);
  },
  'click .done': function (event, template) {
    Session.set("showInviteDialog", false);
    return false;
  }
});

Template.inviteDialog.uninvited = function () {
  var place = Places.findOne(Session.get("selectedPlace"));
  if (! place)
    return []; // place hasn't loaded yet
  return Meteor.users.find({$nor: [{_id: {$in: place.invited}},
                                   {_id: place.owner}]});
};

Template.inviteDialog.displayName = function () {
  return displayName(this);
};

///////////////////////////////////////////////////////////////////////////////
// dialogs

Template.dialogs.openPlaceResourceAddDialog = function () {
  return Session.get("showResourceAddDialog");
};

Template.dialogs.openPlaceCreateDialog = function () {
  return Session.get("showPlaceCreateDialog");
};

Template.dialogs.showInviteDialog = function () {
  return Session.get("showInviteDialog");
};

///////////////////////////////////////////////////////////////////////////////
// Add resource dialog

Template.placeResourceAddDialog.saveDisabled = function () {
  return Session.get("selectedResourceId") ? null : "disabled";
}

var schedResourceAddDialog = function () {
  Session.set("placeResourceAddError", null);
  Session.set("selectedResourceId", null);
  Session.set("selectedCategoryId", null);
  Session.set("showResourceAddDialog", true);
};

Template.placeResourceAddDialog.events({
  'click .save': function (event, template) {
    if (!_.isUndefined(event.target.attributes.disabled)) {
      return;
    }
    var resource = template.find(".resourceList").value;
    var description = template.find(".description").value;
    var public = ! template.find(".private").checked;

    if (resource) {
      Meteor.call("placeResourceAdd", { 
        placeId: Session.get("selectedPlace"),
        resourceId: resource,
        description: description,
        public: public,
      }, function (error) {
        if (error) {
          console.log("error: " + error);
          Session.set("placeResourceAddError", error.toString());
        }
        else {
          console.log("resource added");
          Session.set("showResourceAddDialog", false);
        }
      });
    } else {
      Session.set("placeResourceAddError", "missing resource");
    }
  },

  'click .cancel': function () {
    Session.set("showResourceAddDialog", false);
  }
});

Template.placeResourceAddDialog.error = function () {
  return Session.get("placeResourceAddError");
};


///////////////////////////////////////////////////////////////////////////////
// placeInfo

Template.placeResourcesPanel.events({
  'click .addResource': function () {
    console.log('adding resource');
    schedResourceAddDialog();
  },
});

Template.placeResourcesPanel.resourceName = function () {
  return Resources.findOne(this.id).name;
};

Template.placeResourcesPanel.placeResources = function () {
  var place = Places.findOne(Session.get("selectedPlace"));
  console.log("place: ", place, " resources: ", place.resources);
  return place.resources;
};

///////////////////////////////////////////////////////////////////////////////
// categorySelect

Template.categorySelect.allCategries = function () {
  return Categories.find({}, {sort: {name: 1}});
};

Template.categorySelect.events({
  'change .categoryList' : function(event, template) {
    Session.set("selectedCategoryId", template.find(".categoryList").value);
    Session.set("selectedResourceId", null);
  },
});

Template.categorySelect.categoriesExist = function () {
  return Categories.find().count() > 0;
};

Template.categorySelect.categoryOptionSelected = function () {
  return Session.get("selectedCategoryId") == this._id ? "selected" : undefined;
};

Template.resourceSelect.needDisable = function () {
  return Session.get("selectedCategoryId") ? undefined : "disabled";
};

Template.resourceSelect.resourceOptionSelected = function () {
  return Session.get("selectedResourceId") == this._id ? "selected" : null;
};

Template.resourceSelect.events({
  'change .resourceList' : function(event, template) {
    Session.set("selectedResourceId", template.find(".resourceList").value);
    template.find(".resourceList").autofocus = true;
  },
});

Template.resourceSelect.resourcesUnderCategory = function () {
    return Resources.find(
      {categoryId: Session.get("selectedCategoryId")}, 
      {sort: {name: 1}});
};

Template.resourceSelect.resourcesExist = function () {
  return Template.resourceSelect.resourcesUnderCategory().count() > 0;
};

///////////////////////////////////////////////////////////////////////////////
// generic global helpers

function objectsEqual(o1, o2) {
  // note this only compare fields, not methods
  return JSON.stringify(o1) == JSON.stringify(o2);
};

function placeGetSelected() {
  return Places.findOne(Session.get("selectedPlace"));
};

easyQuote = function (s) {
  return " '" + s + "' ";
};
