///////////////////////////////////////////////////////////////////////////////
// Create Place dialog

var unsetActiveDialog = function (name) {
  var currActiveDialog = Session.get("activeDialog");
  if (currActiveDialog && (currActiveDialog == name || !name)) {
    console.log("removing active dialog:", currActiveDialog);
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
  $("#eModalDialog").on('shown', function () {
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
      var placeId = Session.get("selectedPlace");
      var doc = {
        title: title,
        description: description,
        location: location,
        public: pub
      };
      if (placeId) {
        doc.placeId = placeId;
      }
      Meteor.call('mtcPlaceUpdate', doc, function (error, place) {
        if (error) {
          console.log("placeEdit failed!", error);
        }
        else {
          if (!placeId) {
            client.placeSet(place);
            Session.set("searchTags", undefined);
          }
          if (!pub && Meteor.users.find().count() > 1) {
            openInviteDialog();
          }
        }
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

Template.placeEditDialog.selectedPlace = function () {
  return !!Session.get("selectedPlace");
};

Template.placeEditDialog.isPrivate = function () {
  var id = Session.get("selectedPlace");
  if (id) {
    return !App.collections.Places.findOne(id).public;
  }
};

Template.placeEditDialog.title = function () {
  var id = Session.get("selectedPlace");
  if (id) {
    return App.collections.Places.findOne(id).title;
  }
};

Template.placeEditDialog.description = function () {
  var id = Session.get("selectedPlace");
  if (id) {
    return App.collections.Places.findOne(id).description;
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
    Meteor.call('mtcInvite', Session.get("selectedPlace"), this._id);
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
  return client.displayName(this);
};

///////////////////////////////////////////////////////////////////////////////
// dialogs

Template.dialogs.isDialogActive = function () {
  return !!Session.get("activeDialog");
};

Template.dialogs.isPlaceResourceAddActive = function () {
  return Session.get("activeDialog") == "placeResourceAdd";
};

Template.dialogs.isPlaceEditActive = function () {
  return Session.get("activeDialog") == "placeEdit";
};

Template.dialogs.isInviteActive = function () {
  return Session.get("activeDialog") == "invite";
};

///////////////////////////////////////////////////////////////////////////////
// Add resource dialog

Template.placeResourceAddDialog.saveDisabled = function () {
  return Session.get("saveDisabled") ? "disabled" : "";
}

client.schedResourceAddDialog = function () {
  Session.set("placeResourceAddError", null);
  Session.set("activeDialog","placeResourceAdd");
};

Template.placeResourceAddDialog.rendered = function () {
  bsModalOnShow("placeResourceAdd");
  var tif = $('.tagsInputField');
  tif.removeData('tagsinput');
  tif.tagsinput(client.tagsInputOptions());
  //   console.log("placeResourceAddDialog->rendered");
};

Template.placeResourceAddDialog.created = function () {
  $("#eModalDialog").on('shown', function () {
    $("input.title").focus();
  });
};

Template.placeResourceAddDialog.events({
  'click .save': function (event, template) {
    console.log("placeResourceAddDialog->save");
    if (!_.isUndefined(event.target.attributes.disabled)) {
      return;
    }
    var title = template.find(".title").value;
    var description = template.find(".description").value;
    var pub = ! template.find(".private").checked;
    var tags = $(".tagsInputField").tagsinput('items');
    console.log("title", title, "description", description, "pub", pub, "tags", tags);
    if (title && tags.length) {
      Meteor.call("mtcPlaceResourceAdd", { 
        placeId: Session.get("selectedPlace"),
        title: title,
        tags: tags,
        description: description,
        public: pub,
      }, function (error, result) {
        if (error) {
          console.log("error: " + error);
          Session.set("placeResourceAddError", error.toString());
        }
        else {
          console.log("added resource", result);
          Session.set("selectedResource", result);
          bsModalOnHide();
        }
      });
    } else {
      Session.set("placeResourceAddError", "Title and tags must be provided");
    }
  },

  'click .cancel': function () {
    bsModalOnHide();
  }
});

Template.placeResourceAddDialog.error = function () {
  return Session.get("placeResourceAddError");
};

