;(function () {
  "use strict";

Meteor.subscribe("directory");
Meteor.subscribe("userDetails");

///////////////////////////////////////////////////////////////////////////////
// menu panel

Template.panelMain.events({
  'click .resourcesSearch': function (){
    Session.set("searchType", "resources");
    client.panelPush("search");
  },
  'click .servicesSearch': function (){
    Session.set("searchType", "services");
    client.panelPush("search");
  },
});

Template.main.rendered = function () {
  $(".resourcesSearch").focus();
  this.handleTagsUpdate = Deps.autorun(function () {
    // TBD: auto calculate from zoom level
    var places = [];
    var resources = [];
    var tags = Session.get("searchTags");
    var center = Session.get("mapCenter");
    if (tags && tags.length) {
      // console.log("tags", tags);
      var tids = _.map(tags, function (t) {
        var v = t.trim().toLowerCase();
        var o = App.collections.Tags.findOne({title: v});
        return o ? o._id : undefined;
      });
      // console.log("tids", tids);
      var missingTags = _.find(tids, function (id) {
        return _.isUndefined(id);
      });
      if (missingTags == undefined) {
        // console.log("all tags found");
        App.collections.Places.find({
          location: {$near : {$geometry: center}, $maxDistance: 5000},
        }).forEach(function (place){
          // console.log("looking in place", place);
          _.map(place.resources, function (rid){
            var resource = App.collections.Resources.findOne(rid);
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
        // resources = App.collections.Resources.find({
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
      places = App.collections.Places.find({
        location: {$near : {$geometry: center}},
      }).fetch();
      // console.log("search invoked w/o tags");
    }
    // console.log("places", places);
    Session.set("placesSearchResults", places);
    Session.set("resourcesSearchResults", resources);
  });
};

Template.main.mapHasCenter = function () {
  return !!Session.get("mapCenter");
};

Template.main.isPanelActive = function (panel) {
  // console.log("isPanelActive", panel);
  if (panel === "place") {
    // console.log("isPanelActive.place");
    return !!Session.get("selectedPlace") && !Session.get("editPlace");
  }
  if (panel === Session.get("panel") && !Session.get("selectedPlace")) {
    return true;
  }
};

Template.main.isDialogActive = function () {
  return !!Session.get("activeDialog");
};

Template.main.mapZoomedEnough = function () {
  return Session.get("mapZoomedEnough");
};

Template.main.canLoadMap = function () {
  return client.isStaticContentReady();
};

///////////////////////////////////////////////////////////////////////////////
// search panel

Template.panelSearch.events({
  'click .goSearch' : function(event, template) {
    var tags = $("#tagsSearchInputField").tagsinput('items');
    Session.set("searchTags", tags);
    // console.log("search tags", tags);
    client.panelPush("resultsList");
  },
  'click .back' : function(event, template) {
    client.panelPop();
  },
  'keyup input' : function(event, template) {
    if (event.which == client.keyCode.ESCAPE) {
      // console.log("escape key");
      client.panelPop();
      event.stopPropagation();
      return false;
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

Template.resultsList.events({
  'click .result' : function(event, template) {
    // console.log("result", event.target);
  },
  'click .back' : function(event, template) {
    client.panelPop();
  },
  'keyup input' : function(event, template) {
    if (event.which == client.keyCode.ESCAPE) {
      // console.log("escape key");
      client.panelPop();
      event.stopPropagation();
      return false;
    }
  },
});

Template.resultsList.resourcesFound = function () {
  var results = Session.get("resourcesSearchResults");
  // console.log("resourcesFound", results);
  return results ? !!results.length : false; 
};

Template.resultsList.showingAllPlaces = function () {
  return !Session.get("searchTags").length;
};

Template.resultsList.results = function () {
  var results = Session.get("resourcesSearchResults");
  // console.log("resultsList", results);
  return results;
};

Template.resultsList.destroyed = function () {
  $(document).unbind("keyup");
};

Template.resultsList.tagTitle = function () {
  return App.collections.Tags.findOne(this).title;
};

Template.resultsList.trSelected = function () {
  if (Session.get("lastSelectedPlaceId") == this.place) {
    return "selectedTableRow";
  }
};

Template.resultsList.rendered = function () {
  // console.log("resultsList rendered");
  var table = $('.resultsListTable');
  table.floatThead({
    scrollContainer: function(t){
      return t.closest('.wrapper');
    }
  });
  var getCurRow = function () {
    var cr = $("table tr.selectedTableRow");
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
        cr.removeClass("selectedTableRow");
      }
      cr = jtarget;
      cr.addClass("selectedTableRow");
    }
  };
  var needResponse = false;
  $(document).on("keydown", function (e) {
    needResponse = true;
  });
  $(document).on("keyup", function(e) {
    if (!needResponse) {
      return;
    }
    var r = getCurRow();
    if (!r)
      return;
    function moveTo(jobj) {
      // console.log("moveTo", r, jobj.length);
      if (jobj.length) {
        // console.log("moving", r, jobj);
        selectResourceRow(jobj);
      }
    };
    var setCenterPlace = function (placeId) {
      client.placeSet(placeId);
      var place = App.collections.Places.findOne(placeId);
      Session.set("mapCenter", place.location);
    }
    // console.log("resultsListRow.keyup", e.keyCode)
    switch(e.keyCode) {
      case client.keyCode.ARROW_UP: {
        // console.log("arrow_up");
        moveTo(r.prev());
        break;
      }
      case client.keyCode.ARROW_DOWN: {
        // console.log("arrow_down");
        moveTo(r.next());
        break;
      }
      case client.keyCode.ESCAPE: {
        // console.log("escape");
        client.panelPop();
        break;
      }
      case client.keyCode.ENTER: {
        var placeId = r[0].dataset.placeid;
        // console.log("enter", placeId, e);
        setCenterPlace(placeId);
        break;
      }
    }
  });
  $(".resultsListRow").click(function(e) {
    // console.log("resultsListRow click", e.currentTarget.dataset.placeid);
    selectResourceRow(e.currentTarget);
    setCenterPlace(e.currentTarget.dataset.placeid);
  });
  var lastSelectedPid = Session.get("lastSelectedPlaceId");
  if (lastSelectedPid ) {
    var selector = $('tr[data-placeid="' + lastSelectedPid + '"]');
    // console.log("lastSelectedPlaceId", lastSelectedPid, selector);
    selectResourceRow(selector.first());
  } else {
    // console.log("lastSelectedPlaceId unset");
    selectResourceRow($(".resultsListRow").first());
  }
}

Template.resultsList.destroyed = function () {
  // console.log("resultsList destroyed");
  $(document).off("keyup keydown");
};

///////////////////////////////////////////////////////////////////////////////
// instructions panel

Template.instructions.anyPlaces = function () {
  return App.collections.Places.find().count() > 0;
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
    var placeTitle = App.collections.Places.findOne(id).title;
    // console.log("request to remove place", id, placeTitle);
    $.confirm({
      text: "Really delete place '" + placeTitle + "'?",
      title: "Confirmation required",
      confirm: function(button) {
        // console.log("confirmed!");
        App.collections.Places.remove(id);
        client.placeSet();
      },
      confirmButton: "Yes",
      cancelButton: "No",
    });
    return false;
  },
  'click .back': function () {
    client.placeSet();
    return false;
  },
  'click .title': function () {
    var location = Session.get("mapCenter");
    var sp = Session.get("selectedPlace");
    location.coordinates = sp.location.coordinates;
    // console.log("clicked title of", sp.title);
    Session.set('mapCenter', location);
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

Template.panelPlace.rendered = function () {
  $(document).bind({
    keyup: function(e) {
      if (e.keyCode == client.keyCode.ESCAPE) {
        // console.log("escape");
        client.placeSet();
      }
    },
  });
};

Template.panelPlace.destroyed = function () {
  $(document).unbind("keyup");
};

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
      return App.collections.Resources.findOne(rid);
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
    tags += _.capitalize(App.collections.Tags.findOne(t).title);
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

}());
