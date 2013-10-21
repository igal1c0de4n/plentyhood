Template.admin.events({
  'click .categoryAdd': function (event, template) {
    Session.set("adminError", null);
    var c = template.find(".category").value;
    if (c.length) {
      Meteor.call('categoryAdd', {
        name: c,
      }, function (error, place) {
        if (error) {
          console.log("catAdd failed:" + error);
          Session.set("adminError", error.toString());
        }
        else {
          console.log("category created");
          template.find(".category").value = "";
        }
      });
    } else {
      Session.set("adminError", "Error: empty category");
    }
  },
  'click .categoryRemove': function (event, template) {
    Session.set("adminError", null);
    var c = template.find(".categoryList").value;
    if (c.length) {
      Meteor.call('categoryRemove', {
        name: c,
      }, function (error, place) {
        if (error) {
          console.log("catRemove failed:" + error);
          Session.set("adminError", error.toString());
        }
        else {
          console.log("category removed");
          template.find(".categoryList").value = "";
        }
      });
    } else {
      Session.set("adminError", "Error: specify category");
    }
  },
});

Template.admin.error = function () {
  return Session.get("adminError");
};

Template.admin.allCategries = function () {
  return Categories.find({});
};

Template.admin.categoryName = function () {
  return this.name;
};
