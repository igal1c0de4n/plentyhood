// All Tomorrow's Parties -- client

Meteor.subscribe("directory");
Meteor.subscribe("parties");

// If no party selected, select one.
Meteor.startup(function () {
  Deps.autorun(function () {
    if (! Session.get("selected")) {
      var party = Parties.findOne();
      if (party)
        Session.set("selected", party._id);
    }
  });
});

///////////////////////////////////////////////////////////////////////////////
// Party details sidebar

Template.details.party = function () {
  return Parties.findOne(Session.get("selected"));
};

Template.details.anyParties = function () {
  return Parties.find().count() > 0;
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
    Parties.remove(this._id);
    return false;
  }
});

///////////////////////////////////////////////////////////////////////////////
// Party attendance widget

Template.attendance.rsvpName = function () {
  var user = Meteor.users.findOne(this.user);
  return displayName(user);
};

Template.attendance.outstandingInvitations = function () {
  var party = Parties.findOne(this._id);
  return Meteor.users.find({$and: [
    {_id: {$in: party.invited}}, // they're invited
    {_id: {$nin: _.pluck(party.rsvps, 'user')}} // but haven't RSVP'd
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

var llmap = null;
var mapViewLast = null;
var circles = [];
var mapViewDefault = { center: [37.35024, -121.95751], zoom: 13 }; // santa clara :)
var initDone = false;


Template.leafletMap.rendered = function() {

  var self = this;
  if (!initDone) {
    renderCount = 0;
    initDone = true;
    llmap = null;
  }
  console.log("rerendered called " + renderCount++);

  var mapView;
  if (mapViewLast) {
    mapView = mapViewLast
    console.log("map centered at last location");
  }
  else {
    mapView = mapViewDefault;
    console.log("map centered at default location");
  }
  var center = mapView.center;
  var zoom = mapView.zoom;
  console.log("map: center=" + mapView.center + 
                ",zoom=" + mapView.zoom +")");
  llmap = L.map('leaflet-map').setView(center, zoom);
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution : 'Tiles: &copy; Esri, National Geographic'
  }).addTo(llmap);

  var selectedCircleStyle = {
    stroke: true,
    color: 'yellow',
    fillColor: '#fb4e00',
    fillOpacity: 0.75,
    opacity: 0.9
  };
  var circleStyle = {
    stroke: false,
    fillColor: '#fb4e00',
    fillOpacity: 0.8
  };

  llmap.on('moveend', function(e) {
    mapViewLast = {};
    mapViewLast.center = llmap.getCenter();
    mapViewLast.zoom = llmap.getZoom();
    console.log('last map center ' + mapViewLast.center.toString() + 
                " zoom=" + mapViewLast.zoom);
  });

  llmap.on('click', function(e) {
    console.log('clicked at latlong: ' + e.latlng);

    // ctrl is meta key to add a new party
    if (e.originalEvent.ctrlKey === true) {
      if (! Meteor.userId()) {
        console.log("must be logged in to create events");
        return;
      }
      openCreateDialog(e.latlng.lat, e.latlng.lng);
    }
  });  

  self.handle = Deps.autorun(function () {
    var parties = Parties.find().fetch();
    if (parties.length) {
      var selected = Session.get('selected');

      //before redawing circles, we want to delete the current ones
      _.each(circles, function (c) {
        llmap.removeLayer(c);
      });
      console.log("zoom level=" + llmap.getZoom() + " center=" + llmap.getCenter());
      _.each(parties, function (party) {
        var circle;
        if (party._id === selected) {
          circle = L.circle([party.lat, party.lng], 120, selectedCircleStyle);
        } else {
          circle = L.circle([party.lat, party.lng], 120, circleStyle);
        }
        circle.partyId = party._id; 
        circle.addTo(llmap);
        circles.push(circle);
        circle.on('click', function(e) {
          Session.set("selected", this.partyId);
        });
      });
    }
  });
}

///////////////////////////////////////////////////////////////////////////////
// Create Party dialog

var openCreateDialog = function (lat, lng) {
  Session.set("createCoords", {lat: lat, lng: lng});
  Session.set("createError", null);
  Session.set("showCreateDialog", true);
};

Template.page.showCreateDialog = function () {
  return Session.get("showCreateDialog");
};

Template.createDialog.events({
  'click .save': function (event, template) {
    var title = template.find(".title").value;
    var description = template.find(".description").value;
    var public = ! template.find(".private").checked;
    var coords = Session.get("createCoords");

    if (title.length && description.length) {
      Meteor.call('createParty', {
        title: title,
        description: description,
        lat: coords.lat,
        lng: coords.lng,
        public: public
      }, function (error, party) {
        if (! error) {
          Session.set("selected", party);
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

Template.page.showInviteDialog = function () {
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
  var party = Parties.findOne(Session.get("selected"));
  if (! party)
    return []; // party hasn't loaded yet
  return Meteor.users.find({$nor: [{_id: {$in: party.invited}},
                                   {_id: party.owner}]});
};

Template.inviteDialog.displayName = function () {
  return displayName(this);
};
