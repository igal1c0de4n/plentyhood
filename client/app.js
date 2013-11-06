;(function () {
  "use strict";

Meteor.subscribe("directory");
Meteor.subscribe("places");
Meteor.subscribe("categories");
Meteor.subscribe("resources");
Meteor.subscribe("services");

Meteor.Router.add({
  '/admin': 'admin',
  '/': 'mainPanel',
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
// main panel

Template.mainPanel.selectedPlace = function () {
  return Places.findOne(Session.get("selectedPlace"));
};

///////////////////////////////////////////////////////////////////////////////
// Place details 

Template.details.anyPlaces = function () {
  return Places.find().count() > 0;
};

Template.details.creatorName = function () {
  var owner = Meteor.users.findOne(this.owner);
  if (owner._id === Meteor.userId())
    return "me";
  return displayName(owner);
};

Template.details.isOwner = function () {
  return this.owner === Meteor.userId();
};

Template.details.events({
  'click .invite': function () {
    openInviteDialog();
    return false;
  },
  'click .removePlace': function () {
    Places.remove(this._id);
    return false;
  }
});

///////////////////////////////////////////////////////////////////////////////
// Place sharedPanel widget

Template.sharedPanel.outstandingInvitations = function () {
  var place = Places.findOne(this._id);
  return Meteor.users.find({_id: {$in: place.invited}});
};

Template.sharedPanel.invitationName = function () {
  return displayName(this);
};

Template.sharedPanel.nobody = function () {
  return ! this.public && this.invited.length === 0;
};

Template.sharedPanel.canInvite = function () {
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
//     console.log("workaround for leaflet rerender call #" + this.renderCount);
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
//     console.log('moveend: latlng=' + view.latlng.toString());
    Session.set('mapView', view);
  });
  
  llmap.on('click', function(e) {
    //     console.log('clicked at latlong: ' + e.latlng);

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
        // remove previous user location
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

//     console.log("mapHandle: places=" + places.length +
//                   " selected=" + selected);
    drawLocations();
  });

  this.handleMapChange = Deps.autorun(function () {
    var view = Session.get('mapView');
    if (!objectsEqual(last.view, view)) {
      llmap.setView(view.latlng, view.zoom);
    }
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
    var pub = ! template.find(".private").checked;
    var coords = Session.get("createCoords");

    if (title.length && description.length) {
      Meteor.call('createPlace', {
        title: title,
        description: description,
        lat: coords.lat,
        lng: coords.lng,
        public: pub
      }, function (error, place) {
        if (! error) {
          Session.set("selectedPlace", place);
          if (! pub && Meteor.users.find().count() > 1)
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
    var pub = ! template.find(".private").checked;

    if (resource) {
      Meteor.call("placeResourceAdd", { 
        placeId: Session.get("selectedPlace"),
        resourceId: resource,
        description: description,
        public: pub
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
  'click .placeResourceAdd': function (event, template) {
    console.log('adding resource');
    schedResourceAddDialog();
  },

  'click .placeResourceRemove': function (event, template) {
    var rid = this.id;
    console.log('removing resource', rid);
    Meteor.call("placeResourceRemove", { 
      placeId: Session.get("selectedPlace"),
      resourceId: rid,
    }, function (error) {
      if (error) {
        console.log("error: " + error);
      }
      else {
        console.log("resource", rid, "removed");
      }
    });
  },
});

Template.placeResourcesPanel.resourceName = function () {
  return Resources.findOne(this.id).name;
};

Template.placeResourcesPanel.placeResources = function () {
  var place = Places.findOne(Session.get("selectedPlace"));
//   console.log("place: ", place, " resources: ", place.resources);
  return place.resources;
};

Template.placeResourcesPanel.isPlaceOwner = function () {
  return this.owner === Meteor.userId();
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

function objectsEqual(o1, o2) {
  // note this only compare fields, not methods
  return JSON.stringify(o1) == JSON.stringify(o2);
};

function placeGetSelected() {
  return Places.findOne(Session.get("selectedPlace"));
};

function displayName(user) {
  if (user.profile && user.profile.name)
    return user.profile.name;
  return user.emails[0].address;
};

}());
