Template.admin.errorExists = function () {
  return Session.get("adminError");
};

Template.admin.getError = function () {
  return "Error: " + Session.get("adminError");
};

var clearNotifications = function () {
  Session.set("adminError", null);
  Session.set("adminInfo", null);
}

Template.admin.info = function () {
  return Session.get("adminInfo");
};

Template.admin.rerenderd = function () {
  clearNotifications();
};

Template.admin.resourceRemoveButtonDisabled = function () {
  return Session.get("selectedResourceId") ? null : "disabled";
}

Template.admin.events({
  'keypress .category' : function(event, template) {
    if (event.which == ENTER_KEY) {
      clientCategoryAdd(template);
      return false;
    }
  },

  'click .categoryAdd': function (event, template) {
    clientCategoryAdd(template);
  },

  'click .categoryRemove': function (event, template) {
    clearNotifications();
    var cid = Session.get("selectedCategoryId");

    if (!cid) {
        Session.set("adminError", "category not selected");
        return;
    }
    var categoryName = getFromSelectionById(Categories, cid).name;

    Meteor.call('categoryRemove', {
      id: cid,
    }, function (error, place) {
      if (error) {
        Session.set("adminError", error.toString());
      }
      else {
        Session.set("adminInfo", 
                    "category" + easyQuote(categoryName) + "removed");
        Session.set("selectedCategoryId", null);
      }
    });
  },

  'keypress .resourceAddTf' : function(event, template) {
    if (event.which == ENTER_KEY) {
      clientResourceAdd(template);
      return false;
    }
  },

  'click .resourceAdd': function (event, template) {
    clientResourceAdd(template);
  },

  'click .resourceRemove': function (event, template) {
    clearNotifications();
    var rid = template.find(".resourceList").value;
    if (!rid) {
      Session.set("adminError", "resource not selected");
      return;
    }
    var resourceName = easyQuote(getFromSelectionById(Resources, rid).name);
    Meteor.call('resourceRemove', {
      id: rid,
    }, function (error, place) {
      if (error) {
        Session.set("adminError", error.toString());
      }
      else {
        Session.set("adminInfo", "resource" + resourceName + "removed");
        Session.set("selectedResourceId", null);
      }
    });
  },
});

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
  return Session.get("selectedCategoryId") == this._id ? "selected" : null;
};

var easyQuote = function (s) {
  return " '" + s + "' ";
};

var clientCategoryAdd = function(template) {
  clearNotifications();
  var n = _(template.find(".category").value).capitalize();

  if (!n.length) {
    Session.set("adminError", "empty category");
    return;
  }
  if (categoryExist(n)) {
    Session.set("adminError", "category" +
                easyQuote(n) + "already exists");
    return;
  }

  Meteor.call('categoryAdd', {
    name: n,
  }, function (error, place) {
    if (error) {
      Session.set("adminError", error.toString());
    }
    else {
      Session.set("adminInfo", "category" + easyQuote(n) + "created");
      template.find(".category").value = "";
    }
  });
};

var clientResourceAdd = function (template) {
  clearNotifications();
  var cid = template.find(".categoryList").value;
  if (!cid) {
    Session.set("adminError", "category not selected");
    return;
  }
  var resourceName = template.find(".resourceAddTf").value;
  if (!resourceName) {
    Session.set("adminError", "empty resource name");
    return;
  }
  Meteor.call('resourceAdd', {
    name: resourceName,
    categoryId: cid,
  }, function (error, place) {
    if (error) {
      Session.set("adminError", error.toString());
    }
    else {
      var categoryName = getFromSelectionById(Categories, cid).name;
      Session.set("adminInfo", "resource" + easyQuote(resourceName) +
                  "created under category" + easyQuote(categoryName));
    }
  });
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

resourcesUnderCategory = function () {
  return Resources.find(
    {categoryId: Session.get("selectedCategoryId")}, 
    {sort: {name: 1}});
};

Template.resourceSelect.resourcesExist = function () {
  return resourcesUnderCategory().count() > 0;
};

