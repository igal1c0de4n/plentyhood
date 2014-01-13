;(function () {
  "use strict";

Meteor.subscribe("directory");
Meteor.subscribe("userDetails");
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
      Session.equals("activePanel", "help");
  }
};

Template.places.isDialogActive = function () {
  return !!Session.get("activeDialog");
};

Template.places.mapZoomedEnough = function () {
  return Session.get("mapZoomedEnough");
};

///////////////////////////////////////////////////////////////////////////////
// help panel

Template.panelHelp.anyPlaces = function () {
  return App.collections.Places.find().count() > 0;
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
    client.placeSet();
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
  return "NA (coords lookup tbd)"
};

Template.details.isOwner = function () {
  return this.owner === Meteor.userId();
};

Template.details.editing = function (what) {
  if (what == "location") {
    return !!Session.get("placeEditLocation");
  }
  return false;
};

Template.details.events({
  'click .invite': function () {
    openInviteDialog();
    return false;
  },
  'click .close': function () {
    client.placeSet();
    return false;
  },
  'click .editLocation': function () {
    client.placeDragSet("edit");
    Session.set("placeEditLocation", true);
    return false;
  },
  'click .cancelEditLocation': function () {
    client.placeDragSet("cancel");
    Session.set("placeEditLocation", false);
    return false;
  },
  'click .saveLocation': function () {
    client.placeDragSet("done");
    Session.set("placeEditLocation", false);
    return false;
  },
  'click .editPlace': function () {
    Session.set("activeDialog", "placeEdit");
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

var schedResourceUpdateDialog = function (isNew) {
  Session.set("resourceUpdateError", null);
  Session.set("activeDialog","resourceUpdate");
  Session.set("resourceCreateNew", isNew);
};

Template.placeResourcesPanel.events({
  'click #resourceAdd': function (event, template) {
    // console.log('adding resource');
    schedResourceUpdateDialog(true);
  },
  'click #resourceRemove': function (event, template) {
    var rid = Session.get("selectedResource");
    // console.log('removing resource', rid);
    Meteor.call("mtcPlaceResourceRemove", { 
      placeId: Session.get("selectedPlace"),
      resourceId: rid,
    }, function (error) {
      if (error) {
        console.log("error: " + error);
      }
      else {
        Session.set("selectedResource", undefined);
        // console.log("resource", rid, "removed");
      }
    });
  },
  'click #resourceEdit': function (event, template) {
    // console.log('editing resource');
    schedResourceUpdateDialog(false);
  },
  'change #resourceSelect': function (event, template) {
    //     console.log("selectedResource", event.target.value);
    Session.set("selectedResource", event.target.value);
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
  if (place.resources) {
    var rnames = _.map(place.resources, function (rid) {
      return App.collections.Resources.findOne(rid);
    });
    return rnames.sort(_.dynamicSort("title"));
  }
};

Template.placeResourcesPanel.isOwner = function () {
  var place = App.collections.Places.findOne(Session.get("selectedPlace"));
  //   console.log("place", place);
  return place.owner === Meteor.userId();
};

Template.placeResourcesPanel.resourceTagsGet = function () {
  var tags = "";
  var firstTime = true;
  _.each(client.selectedResourceGet().tags, function (t) {
    if (firstTime) {
      firstTime = false;
    }
    else {
      tags += ",";
    }
    tags += App.collections.Tags.findOne(t).title;
  });
  return tags;
};

Template.placeResourcesPanel.isResourceSelected = function () {
  return !!Session.get("selectedResource") && !!client.selectedResourceGet();
};

Template.placeResourcesPanel.resourceDescription = function () {
  return client.selectedResourceGet().description;
};

Template.placeResourcesPanel.markSelected = function (rid) {
  return Session.equals("selectedResource", rid) ? "selected" : "";
};

///////////////////////////////////////////////////////////////////////////////
// search panel

Template.searchPanel.events({
  'click .goSearch' : function(event, template) {
    var tags = $("#tagsSearchInputField").tagsinput('items');
    Session.set("searchTags", tags);
    console.log("search tags", tags);
  },
});

Template.searchPanel.rendered = function () {
  // console.log("searchPanel->rendered");
  var tif = $('#tagsSearchInputField');
  // workaround: if the template is being re-rendered
  // the input element already has a 'tagsinput' data.
  // this tagsinput is already initialized, so we have to
  // discard of it before we initialize it again
  // (if not tagsinput errs while relating to the init object 
  // as a function name)
  tif.removeData('tagsinput');
  $(".bootstrap-tagsinput").remove();
  tif.tagsinput(client.tagsInputOptions());
  $("div.bootstrap-tagsinput > input").focus();
};

}());
