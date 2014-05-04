app = {};

;(function () {
  "use strict";

///////////////////////////////////////////////////////////////////////////////
// panelBgin

Template.panelBegin.events({
  'click .resourcesSearch': function (){
    Session.set("searchType", "resources");
    panels.push("pSearch");
  },
  'click .servicesSearch': function (){
    Session.set("searchType", "services");
    panels.push("pSearch");
  },
  'click .locateTrig': function (){
    Session.set("userLocateTrigger", true);
  },
});

Template.panelBegin.rendered = function () {
  $(".resourcesSearch").focus();
};

Template.panelBegin.locateAvailable = function() {
  return Session.get("locationAvailable");
}

///////////////////////////////////////////////////////////////////////////////
// panelBgin

Template.placesMap.created = function () {
  var sessionVars = [
    "searchTags",
    "placesSearchResults",
    "locationAvailable",
    "panel",
  ];
  client.sessionUnsetList(sessionVars);
  panels.clear();
  this.handleTagsUpdate = Deps.autorun(function () {
    // TBD: auto calculate from zoom level
    var places = [];
    var resources = [];
    var tags = Session.get("searchTags");
    var center = Session.get("mapCenter");
    if (Session.get("mapSubscriptionsReady")) {
      // cause recompute
      Session.set("mapSubscriptionsReady", false);
    } 
    if (!center || !subscriptions.multiReady(["places", "resources", "tags"])) {
      // console.log("handleTagsUpdate: subscriptions not ready");
      return;
    }
    if (!Session.get("searchTrigger")) {
      // console.log("search not triggered so skipped");
      return;
    } 
    Session.set("searchTrigger", false);
    // console.log("handleTagsUpdate run");
    if (tags && tags.length) {
      // console.log("tags", tags);
      var tids = _.map(tags, function (t) {
        var v = t.trim().toLowerCase();
        var o = collections.Tags.findOne({title: v});
        return o ? o._id : undefined;
      });
      // console.log("tids", tids);
      var missingTags = _.find(tids, function (id) {
        return _.isUndefined(id);
      });
      if (missingTags == undefined) {
        // console.log("all tags found");
        collections.Places.find({
          location: {$near : {$geometry: center}, $maxDistance: 5000},
        }).forEach(function (place){
          // console.log("looking in place", place);
          _.map(place.resources, function (rid){
            var resource = collections.Resources.findOne(rid);
            if (!resource) {
              console.error("cannot find resource", rid, "under place", place._id);
              return;
            }
            var tagsAreMissing = _.find(tids, function(tid){
              var found = _.find(resource.tags, function(t){
                return t === tid;
              });
              return !found;
            });
            if (!tagsAreMissing) {
              // found a resource with all the tags
              // console.log("resource", resource.title, 
              //             "at place", place.title, "meets search criteria!");
              places.push(place);
              resources.push(resource);
            }
          })
        });
        // TBD: improve search performance by duplicating place 
        // location in every resource, and using:
        //
        // resources = collections.Resources.find({
        //   location: {$near : {$geometry: center}, $maxDistance: ...},
        //   'tags' : {'$all': tids}
        // })
      }
      else {
        // this should be an illegal search, once the tagsinput field
        // prevents inserting non-existant tags
        // TBD: throw error instead
        //
        // some tags are not even in the database 
        // - don't bother with query, no places has those resources
        // console.log("search for non-existing tags!");
      }
    }
    else {
      // backdoor cheat to see all places
      places = collections.Places.find({
        location: {$near : {$geometry: center}},
      }).fetch();
      // console.log("search invoked w/o tags");
    }
    // console.log("places", places);
    Session.set("placesSearchResults", places);
    Session.set("resourcesSearchResults", resources);
  });
  this.handleSubscriptions = Deps.autorun(function () {
    var b = Session.get("mapBounds");
    if (b) {
      // console.log("subscribing with bounds", b)
      // console.log("all places", collections.Places.find().fetch());
      // must subscribe places separately bc of parameter
      subscriptions.multiAdd(["tags", "resources", ["places", b]], function (){
        // console.log("subscription ready");
        Session.set("mapSubscriptionsReady", true);
      });
    }
  });
  // trigger handleTagsUpdate run to show all places
  Session.set("searchTags", "");
};

Template.placesMap.destroyed = function () {
  this.handleTagsUpdate.stop();
  this.handleSubscriptions.stop();
  subscriptions.multiRemove(["places", "tags", "resources"]);
};

Template.placesMap.mapHasCenter = function () {
  return !!Session.get("mapCenter");
};

Template.placesMap.isPanelActive = function (panel) {
  var cp = Session.get("panel");
  // console.log("isPanelActive current", cp, "checked against", panel);
  return panel == cp;
};

Template.placesMap.isDialogActive = function () {
  return !!Session.get("activeDialog");
};

Template.placesMap.mapZoomedOut = function () {
  var ze = Session.get("mapZoomedEnough");
  var ult = Session.get("userLocateTrigger");
  // console.log("zoomedEnough", ze, ult);
  return !ze && !ult;
};

Template.placesMap.canLoadMap = function () {
  return client.isStaticContentReady();
};

///////////////////////////////////////////////////////////////////////////////
// panel back button

Template.panelBackButton.events({
  'click .panelBack' : panels.backAction,
});

///////////////////////////////////////////////////////////////////////////////
// search panel

var panelSearchAction = function () {
  var tags = $("#tagsSearchInputField").tagsinput('items');
  Session.set("searchTags", tags);
  Session.set("searchTrigger", true);
  // console.log("search tags", tags);
  panels.push("pResultsList");
};

Template.panelSearch.prvTags = function () {
  var tags = Session.get("searchTags");
  var tagsList = tags ? tags.join(",") : undefined;
  // console.log("tagsList", tagsList);
  return tagsList;
};

Template.panelSearch.events({
  'click .goSearch' : function(event, template) {
    if (!panelSearchAction.enterKeyPressed) {
      // console.log("goSearch real click");
      panelSearchAction();
    } else {
      // console.log("goSearch click ignored");
    }
  },
  'keydown .goSearch': function (e){
    if (e.keyCode == client.keyCode.ENTER) {
      // console.log("goSearch enter keydown");
      panelSearchAction.enterKeyPressed = true;
    }
  },
  'keyup .goSearch': function (e){
    if (e.keyCode == client.keyCode.ENTER) {
      // console.log("goSearch enter keyup");
      panelSearchAction.enterKeyPressed = false;
      panelSearchAction();
    }
  },
});

Template.panelSearch.rendered = function () {
  // console.log("panelSearch->rendered");
  var tif = $('#tagsSearchInputField');
  // workaround: if the template is being re-rendered
  // the input element already has a 'tagsinput' data.
  // this tagsinput is already initialized, so we have to
  // discard of it before we initialize it again
  // (if not tagsinput errs while relating to the init object 
  // as a function name)
  tif.removeData('tagsinput');
  $(".bootstrap-tagsinput").remove();
  tif.tagsinput(client.tagsInputOptions);
  $(".bootstrap-tagsinput > input").focus().attr("autocomplete","off");
  Session.set("lastSelectedPlaceId", undefined);
};

///////////////////////////////////////////////////////////////////////////////
// resultsList panel

Template.resultsList.resourcesFound = function () {
  var results = Session.get("resourcesSearchResults");
  // console.log("resourcesFound", results);
  return results ? !!results.length : false; 
};

Template.resultsList.showingAllPlaces = function () {
  var st = Session.get("searchTags");
  return !st || !st.length;
};

Template.resultsList.results = function () {
  var results = Session.get("resourcesSearchResults");
  // console.log("resultsList", results);
  return results;
};

Template.resultsList.tagTitle = function () {
  return collections.Tags.findOne(this).title;
};

Template.resultsList.rSelected = function () {
  if (Session.get("lastSelectedPlaceId") == this.place) {
    return "selectedRLEntry";
  }
};

var setCenterPlace = function (placeId) {
  client.placeSet(placeId);
  var place = collections.Places.findOne(placeId);
  Session.set("mapCenterLast", Session.get("mapCenter"));
  mapProvider.centerSet(place.location, true);
  panels.push("place");
};

var getCurRow = function () {
  var cr = $("div.selectedRLEntry");
  if (cr) {
    // prevent selector from getting cluttered
    cr.selector = "";
  }
  return cr;
};

var selectResourceRow = function (target) {
  var jtarget = $(target);
  // console.log("target", target, "jtarget", jtarget);
  var cr = getCurRow();
  if (cr != jtarget) {
    if (cr) {
      cr.removeClass("selectedRLEntry");
    }
    cr = jtarget;
    cr.addClass("selectedRLEntry");
  }
};

var rListEntryAction = function (event) {
  // console.log("rListEntry click", e.currentTarget.dataset.placeid);
  selectResourceRow(event.currentTarget);
  setCenterPlace(event.currentTarget.dataset.placeid);
};

Template.resultsList.events({
  'tap .rListEntry': function (event, template) {
    rListEntryAction(event);
  },
  'click .rListEntry': function (event, template) {
    rListEntryAction(event);
  },
});

Template.resultsList.rendered = function () {
  var lastSelectedPid = Session.get("lastSelectedPlaceId");
  if (lastSelectedPid ) {
    var selector = $('div[data-placeid="' + lastSelectedPid + '"]');
    // console.log("lastSelectedPlaceId", lastSelectedPid, selector);
    selectResourceRow(selector.first());
  } else {
    // console.log("lastSelectedPlaceId unset");
    selectResourceRow($(".rListEntry").first());
  }
};

Template.resultsList.placeName = function () {
  var place = collections.Places.findOne(this.placeId)
  return place ? place.title : "load failed!";
};

///////////////////////////////////////////////////////////////////////////////
// instructions panel

Template.instructions.anyPlaces = function () {
  return collections.Places.find().count() > 0;
};

///////////////////////////////////////////////////////////////////////////////
// place panel

Template.panelPlace.selectedPlaceGet = function () {
  return Session.get("selectedPlace");
};

Template.panelPlace.isOwner = function () {
  return this.owner === Meteor.userId();
};

Template.panelPlace.events({
  'click .removePlace': function () {
    var id = this._id;
    var placeTitle = collections.Places.findOne(id).title;
    // console.log("request to remove place", id, placeTitle);
    $.confirm({
      text: "Really delete place '" + placeTitle + "'?",
      title: "Confirmation required",
      confirm: function(button) {
        // console.log("confirmed!");
        collections.Places.remove(id);
        client.placeSet();
      },
      confirmButton: "Yes",
      cancelButton: "No",
    });
    return false;
  },
  'click .title': function () {
    var location = Session.get("mapCenter");
    var sp = Session.get("selectedPlace");
    location.coordinates = sp.location.coordinates;
    // console.log("clicked title of", sp.title);
    mapProvider.centerSet(location, true);
    return false;
  },
  'click .editLocation': function () {
    mapProvider.placeDragSet("edit");
    Session.set("placeEditLocation", true);
    return false;
  },
  'click .cancelEditLocation': function () {
    mapProvider.placeDragSet("cancel");
    Session.set("placeEditLocation", false);
    return false;
  },
  'click .saveLocation': function () {
    mapProvider.placeDragSet("done");
    Session.set("placeEditLocation", false);
    return false;
  },
  'click .editPlace': function () {
    Session.set("activeDialog", "placeEdit");
    return false;
  },
});

///////////////////////////////////////////////////////////////////////////////
// Place details 

Template.details.creatorName = function () {
  var owner = Meteor.users.findOne(this.owner);
  if (!owner) {
    return "";
  }
  return owner._id === Meteor.userId() ? "me" : client.displayName(owner);
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
});

///////////////////////////////////////////////////////////////////////////////
// Place sharedPanel widget

Template.sharedPanel.outstandingInvitations = function () {
  var place = collections.Places.findOne(this._id);
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
      placeId: client.selectedPlaceId(),
      resourceId: rid,
    }, function (error) {
      if (error) {
        // console.log("error: " + error);
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
  var place = Session.get("selectedPlace");
  //   console.log("place: ", place, " resources: ", place.resources);
  return !place.resources || place.resources.length === 0 ? false : true;
};

Template.placeResourcesPanel.placeResources = function () {
  var place = Session.get("selectedPlace");
  //   console.log("place: ", place, " resources: ", place.resources);
  if (place.resources) {
    var rnames = _.map(place.resources, function (rid) {
      return collections.Resources.findOne(rid);
    });
    return rnames.sort(_.dynamicSort("title"));
  }
};

Template.placeResourcesPanel.isOwner = function () {
  var place = Session.get("selectedPlace");
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
      tags += ", ";
    }
    tags += _.capitalize(collections.Tags.findOne(t).title);
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
// place panelZoomedOut

Template.panelZoomedOut.locateAvailable = function () {
  return Session.get("locationAvailable");
};

///////////////////////////////////////////////////////////////////////////////
// init

// setup exports
app.setCenterPlace = setCenterPlace;
app.getCurRow = getCurRow;
app.selectResourceRow = selectResourceRow;

}());
