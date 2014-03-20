///////////////////////////////////////////////////////////////////////////////
// Create Place dialog

var unsetActiveDialog = function (name) {
  var currActiveDialog = Session.get("activeDialog");
  if (currActiveDialog && (currActiveDialog == name || !name)) {
    //     console.log("removing active dialog:", currActiveDialog);
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

Template.placeEditDialog.rendered = function () {
  bsModalOnShow("placeEdit");
  $("#eModalDialog").on('shown.bs.modal', function () {
    $("input.title").focus();
  });
};

Template.placeEditDialog.events({
  'click .save': function (event, template) {
    var title = template.find(".title").value;
    var description = template.find(".description").value;
    var pub = ! template.find(".private").checked;
    var location = Session.get("placeLocation");
    if (title.length && description.length) {
      var placeId = client.selectedPlaceId();
      var doc = {
        title: title,
        description: description,
        location: location,
        public: pub
      };
      if (placeId) {
        doc.placeId = placeId;
      }
      Meteor.call('mtcPlaceUpdate', doc, function (error, pid) {
        if (error) {
          console.log("placeEdit failed!", error);
        }
        else {
          // console.log("placeEditDialog.mtcPlaceUpdate", pid);
          if (!placeId) {
            client.placeSet(pid);
            // make sure that place shows on map
            Session.set("searchTags", undefined);
          }
          if (!pub && Meteor.users.find().count() > 1) {
            openInviteDialog();
          }
        }
        Session.set("selectedPlace", App.collections.Places.findOne(pid));
      });
      bsModalOnHide("placeEdit");
    } else {
      Session.set("createError",
                  "It needs a title and a description, or why bother?");
    }
  },
  'click .cancel': function () {
    bsModalOnHide();
  }
});

Template.placeEditDialog.isPlaceSelected = function () {
  return !!Session.get("selectedPlace");
};

Template.placeEditDialog.isPrivate = function () {
  var p = Session.get("selectedPlace");
  if (p) {
    return !p.public;
  }
};

Template.placeEditDialog.title = function () {
  var p = Session.get("selectedPlace");
  if (p) {
    return p.title;
  }
};

Template.placeEditDialog.description = function () {
  var p = Session.get("selectedPlace");
  if (p) {
    return p.description;
  }
};

Template.placeEditDialog.error = function () {
  return Session.get("createError");
};

///////////////////////////////////////////////////////////////////////////////
// Invite dialog

var openInviteDialog = function () {
  Session.set("activeDialog", "invite");
};

Template.inviteDialog.events({
  'click .invite': function (event, template) {
    Meteor.call('mtcInvite', client.selectedPlaceId(), this._id);
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
  var place = Session.get("selectedPlace");
  if (_.isUndefined(place))
    return []; // place hasn't loaded yet
  return Meteor.users.find({$nor: [{_id: {$in: place.invited}},
                                   {_id: place.owner}]});
};

Template.inviteDialog.displayName = function () {
  return client.displayName(this);
};

///////////////////////////////////////////////////////////////////////////////
// dialogs

Template.dialogs.isDialogActive = function () {
  return !!Session.get("activeDialog");
};

Template.dialogs.isPlaceResourceUpdateActive = function () {
  return Session.equals("activeDialog", "resourceUpdate");
};

Template.dialogs.isPlaceEditActive = function () {
  return Session.equals("activeDialog", "placeEdit");
};

Template.dialogs.isInviteActive = function () {
  return Session.equals("activeDialog", "invite");
};

///////////////////////////////////////////////////////////////////////////////
// Add resource dialog


var isCreateNewResource = function () {
  return Session.equals("resourceCreateNew", true);
};

Template.resourceUpdateDialog.createNew = function () {
  return isCreateNewResource();
};

Template.resourceUpdateDialog.title = function () {
  return isCreateNewResource() ? "" : client.selectedResourceGet().title;
};

Template.resourceUpdateDialog.description = function () {
  return isCreateNewResource() ? "" : client.selectedResourceGet().description;
};

Template.resourceUpdateDialog.isPrivate = function () {
  return isCreateNewResource() ? "" : !client.selectedResourceGet().public;
};

Template.resourceUpdateDialog.tags = function () {
  if (isCreateNewResource()) {
    return "";
  }
  var tagsStr = "";
  _.each(client.selectedResourceGet().tags, function (t) {
    if (tagsStr) {
      tagsStr += ",";
    }
    var name = App.collections.Tags.findOne(t).title;
    //     console.log("tag", t, name);
    tagsStr += name;
  });
  return tagsStr;
};

Template.resourceUpdateDialog.saveDisabled = function () {
  return Session.get("saveDisabled") ? "disabled" : "";
};

Template.resourceUpdateDialog.created = function () {
  $("#eModalDialog").on('shown.bs.modal', function () {
    // console.log("resourceUpdateDialog.created.shown");
    $("input.title").focus();
  });
};

Template.resourceUpdateDialog.rendered = function () {
  bsModalOnShow("resourceUpdate");
  var tif = $('.tagsInputField');
  tif.removeData('tagsinput');
  $(".bootstrap-tagsinput").remove();
  tif.tagsinput(client.tagsInputOptions);
  $("#eModalDialog").on('shown.bs.modal', function () {
    // console.log("resourceUpdateDialog->shown");
    $("input.title").focus();
  });
  // console.log("resourceUpdateDialog->rendered");
};

Template.resourceUpdateDialog.events({
  'click .save': function (event, template) {
    //     console.log("resourceUpdateDialog->save");
    if (!_.isUndefined(event.target.attributes.disabled)) {
      return;
    }
    var title = template.find(".title").value;
    var description = template.find(".description").value;
    var pub = !template.find(".private").checked;
    var tags = $(".tagsInputField").tagsinput('items');
    //     console.log("title", title, "description", description, 
    //     "pub", pub, "tags", tags);
    var placeId = client.selectedPlaceId();
    var args = { 
      placeId: placeId,
      title: title,
      tags: tags,
      description: description,
      public: pub,
    }
    if (!isCreateNewResource()) {
      args.resourceId = Session.get("selectedResource");
    }
    if (title && tags.length) {
      Meteor.call("mtcResourceUpdate", args, function (error, resourceId) {
        if (error) {
          // console.log("error: ", error);
          Session.set("resourceUpdateError", error.toString());
          return;
        }
        // console.log("updated resource", resourceId);
        Session.set("selectedResource", resourceId);
        if (isCreateNewResource()) {
          // user asked to add a new resource, so add it to place
          // console.log("resourceUpdateDialog->save about to add", placeId, resourceId);
          Meteor.call("mtcPlaceResourceAdd", {
            placeId: placeId,
            resourceId: resourceId,
          }, function (error) {
            if (error) {
              // console.log("error: " + error);
              Session.set("resourceUpdateError", error.toString());
            }
            else {
              // console.log("added resource", resourceId, "to place", placeId);
              bsModalOnHide();
            }
          });
        } else {
          bsModalOnHide();
        }
        client.placeSet(placeId);
      });
    } else {
      Session.set("resourceUpdateError", "Title and tags must be provided");
    }
  },
  'click .cancel': function () {
    bsModalOnHide();
  }
});

Template.resourceUpdateDialog.error = function () {
  return Session.get("resourceUpdateError");
};

