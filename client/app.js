;(function () {
  "use strict";

Meteor.subscribe("directory");
Meteor.subscribe("places");
Meteor.subscribe("categories");
Meteor.subscribe("resources");
Meteor.subscribe("services");

// If no place selected, select one.
Meteor.startup(function () {
  Meteor.call("getNodeEnv", function (error, result) {
    console.log("app environment: " + result);
  });

  Deps.autorun(function () {
    if (! Session.get("selectedPlace")) {
      var place = App.collections.Places.findOne();
      if (place)
        Session.set("selectedPlace", place._id);
    }
  });
});

///////////////////////////////////////////////////////////////////////////////
// main panel

Template.places.selectedPlace = function () {
  return App.collections.Places.findOne(Session.get("selectedPlace"));
};

Template.places.anyPlaces = function () {
  return App.collections.Places.find().count() > 0;
};

///////////////////////////////////////////////////////////////////////////////
// Place Container

Template.placeContainer.isOwner = function () {
  return this.owner === Meteor.userId();
};

Template.placeContainer.events({
  'click .removePlace': function () {
    App.collections.Places.remove(this._id);
    return false;
  },
});

///////////////////////////////////////////////////////////////////////////////
// Place details 

Template.details.creatorName = function () {
  var owner = Meteor.users.findOne(this.owner);
  if (owner._id === Meteor.userId())
    return "my place";
  return "Owner: " + displayName(owner);
};

Template.details.placeLocationGet = function () {
  return "(" + this.lat + "," + this.lng + ")";
};

Template.details.isOwner = function () {
  return this.owner === Meteor.userId();
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
  return displayName(this);
};

Template.sharedPanel.nobody = function () {
  return ! this.public && this.invited.length === 0;
};

Template.sharedPanel.canInvite = function () {
  return ! this.public && this.owner === Meteor.userId();
};

///////////////////////////////////////////////////////////////////////////////
// Create Place dialog

var schedCreateDialog = function (lat, lng) {
  Session.set("createCoords", {lat: lat, lng: lng});
  Session.set("createError", null);
  Session.set("activeDialog", "placeCreate");
};

var unsetActiveDialog = function (name) {
  var currActiveDialog = Session.get("activeDialog");
  if (currActiveDialog && (currActiveDialog == name || !name)) {
    console.log("resetting active dialog from", currActiveDialog);
    Session.set("activeDialog", undefined);
  }
};

var bsModalOnShow = function (name) {
  $('#eModalDialog').modal();
  $('#eModalDialog').on('hide.bs.modal', function () {
    unsetActiveDialog(name);
  })
}

var bsModalOnHide = function (name) {
  $('#eModalDialog').modal('hide');
}

Template.placeCreateDialog.rendered = function () {
  bsModalOnShow("placeCreate");
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
      bsModalOnHide("placeCreate");
    } else {
      Session.set("createError",
                  "It needs a title and a description, or why bother?");
    }
  },

  'click .cancel': function () {
    bsModalOnHide();
  }
});

Template.placeCreateDialog.error = function () {
  return Session.get("createError");
};

///////////////////////////////////////////////////////////////////////////////
// Invite dialog

var openInviteDialog = function () {
  Session.set("activeDialog", "invite");
};

Template.inviteDialog.events({
  'click .invite': function (event, template) {
    Meteor.call('invite', Session.get("selectedPlace"), this._id);
  },
  'click .done': function (event, template) {
    bsModalOnHide();
    return false;
  }
});

Template.inviteDialog.rendered = function () {
  bsModalOnShow("invite");
};

Template.inviteDialog.uninvited = function () {
  var place = App.collections.Places.findOne(Session.get("selectedPlace"));
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

Template.dialogs.isDialogActive = function () {
  return !!Session.get("activeDialog");
};

Template.dialogs.isPlaceResourceAddActive = function () {
  return Session.get("activeDialog") == "placeResourceAdd";
};

Template.dialogs.isPlaceCreateActive = function () {
  return Session.get("activeDialog") == "placeCreate";
};

Template.dialogs.isInviteActive = function () {
  return Session.get("activeDialog") == "invite";
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
  Session.set("activeDialog","placeResourceAdd");
};

Template.placeResourceAddDialog.rendered = function () {
  bsModalOnShow("placeResourceAdd");
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
          bsModalOnHide();
        }
      });
    } else {
      Session.set("placeResourceAddError", "missing resource");
    }
  },

  'click .cancel': function () {
    bsModalOnHide();
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
  var r = App.collections.Resources.findOne(this.id);
  return r ? r.name : "loading...";
};

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

Template.placeResourcesPanel.isPlaceOwner = function () {
  return this.owner === Meteor.userId();
};

///////////////////////////////////////////////////////////////////////////////
// categorySelect

Template.categorySelect.allCategries = function () {
  return App.collections.Categories.find({}, {sort: {name: 1}});
};

Template.categorySelect.events({
  'change .categoryList' : function(event, template) {
    Session.set("selectedCategoryId", template.find(".categoryList").value);
    Session.set("selectedResourceId", null);
  },
});

Template.categorySelect.categoriesExist = function () {
  return App.collections.Categories.find().count() > 0;
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
    return App.collections.Resources.find(
      {categoryId: Session.get("selectedCategoryId")}, 
      {sort: {name: 1}});
};

Template.resourceSelect.resourcesExist = function () {
  return Template.resourceSelect.resourcesUnderCategory().count() > 0;
};

///////////////////////////////////////////////////////////////////////////////

function placeGetSelected() {
  return App.collections.Places.findOne(Session.get("selectedPlace"));
};

function displayName(user) {
  if (user.profile && user.profile.name)
    return user.profile.name;
  return user.emails[0].address;
};

}());
