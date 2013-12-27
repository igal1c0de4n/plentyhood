;(function () {
  "use strict";

Meteor.subscribe("directory");
Meteor.subscribe("places");
Meteor.subscribe("tags");
Session.set("activePanel", "help");

// If no place selected, select one.
Meteor.startup(function () {
  Meteor.call("mtcNodeEnvGet", function (error, result) {
    console.log("app environment: " + result);
  });
});

///////////////////////////////////////////////////////////////////////////////
// places panel

Template.places.isPanelActive = function (name) {
  if (Session.get("disablePanel")) {
    return false;
  }
  if (name == "search") {
    return Session.get("mapZoomedEnough");
  }
  if (name == "place") {
    return !!Session.get("selectedPlace") && !Session.get("editPlace");
  }
  if (name == "edit") {
    return !!Session.get("editPlace");
  }
  if (name == "help") {
    return !Session.get("selectedPlace") &&
      Session.get("activePanel") == "help";
  }
};

Template.places.isDialogActive = function () {
  return !!Session.get("activeDialog");
};

///////////////////////////////////////////////////////////////////////////////
// help panel

Template.panelHelp.anyPlaces = function () {
  return App.collections.Places.find().count() > 0;
};

Template.panelHelp.mapZoomedEnough = function () {
  return Session.get("mapZoomedEnough");
};

///////////////////////////////////////////////////////////////////////////////
// place panel

Template.panelPlace.selectedPlace = function () {
  return App.collections.Places.findOne(Session.get("selectedPlace"));
};

Template.panelPlace.isOwner = function () {
  return this.owner === Meteor.userId();
};

Template.panelPlace.events({
  'click .removePlace': function () {
    App.collections.Places.remove(this._id);
    Session.set("selectedPlace", undefined);
    return false;
  },
  'click .movePlaceOnMap': function () {
    console.log("implementation tbd");
    return false;
  },
});

///////////////////////////////////////////////////////////////////////////////
// Place details 

Template.details.creatorName = function () {
  var owner = Meteor.users.findOne(this.owner);
  if (owner._id === Meteor.userId())
    return "my place";
  return "User: " + client.displayName(owner);
};

Template.details.placeLocationGet = function () {
  //   return "(" + this.lat + "," + this.lng + ")";
  return "(tbd, lookup from GPS)"
};

Template.details.isOwner = function () {
  return this.owner === Meteor.userId();
};

Template.details.events({
  'click .invite': function () {
    openInviteDialog();
    return false;
  },
  'click .close': function () {
    Session.set("selectedPlace", undefined);
    return false;
  },
});

///////////////////////////////////////////////////////////////////////////////
// Place sharedPanel widget

Template.sharedPanel.outstandingInvitations = function () {
  var place = App.collections.Places.findOne(this._id);
  return Meteor.users.find({_id: {$in: place.invited}});
};

Template.sharedPanel.invitationName = function () {
  return client.displayName(this);
};

Template.sharedPanel.nobody = function () {
  return ! this.public && this.invited.length === 0;
};

Template.sharedPanel.canInvite = function () {
  return ! this.public && this.owner === Meteor.userId();
};

///////////////////////////////////////////////////////////////////////////////
// place resource panel

Template.placeResourcesPanel.events({
  'click .placeResourceAdd': function (event, template) {
    console.log('adding resource');
    client.schedResourceAddDialog();
  },
  'click .placeResourceRemove': function (event, template) {
    var rid = this._id;
    console.log('removing resource', rid);
    Meteor.call("mtcPlaceResourceRemove", { 
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

Template.placeResourcesPanel.placeHasResources = function () {
  var place = App.collections.Places.findOne(Session.get("selectedPlace"));
  //   console.log("place: ", place, " resources: ", place.resources);
  return !place.resources || place.resources.length === 0 ? false : true;
};

Template.placeResourcesPanel.placeResources = function () {
  var place = App.collections.Places.findOne(Session.get("selectedPlace"));
  //   console.log("place: ", place, " resources: ", place.resources);
  return place.resources;
};

Template.placeResourcesPanel.isOwner = function () {
  var place = App.collections.Places.findOne(Session.get("selectedPlace"));
  return place.owner === Meteor.userId();
};

///////////////////////////////////////////////////////////////////////////////
// search panel

Template.searchPanel.events({
  'click .goSearch' : function(event, template) {
    var tags = $(".tagsSearchInputField").tagsinput('items');
    Session.set("searchTags", tags);
    console.log("search tags", tags);
  },
});

Template.searchPanel.rendered = function () {
  var tif = $('.tagsSearchInputField');
  tif.tagsinput(client.tagsInputOptions());
  //   console.log("searchPanel->rendered");
  $("div.bootstrap-tagsinput > input").focus();
};

}());
