(function() {
  "use strict";

  ///////////////////////////////////////////////////////////////////////////////
  // admin

  Template.admin.tagSelected = function() {
    return Session.get("selectedTag") ? true : false;
  };

  Template.admin.errorExists = function() {
    return Session.get("adminError");
  };

  Template.admin.getError = function() {
    return "Error: " + Session.get("adminError");
  };

  Template.admin.info = function() {
    return Session.get("adminInfo");
  };

  Template.admin.rerenderd = function() {
    clearNotifications();
  };

  Template.admin.events({
    'keypress .search-query': function(event, template) {
      if (event.which == client.keyCode.ENTER) {
        console.log("search stub for", event.target.value)
        return false;
      }
    },
  });

  ////////////////////////////////////////////////////////////////////
  // displayUsers

  Template.displayUsers.helpers({
    users: function() {
      return Meteor.users.find();
    },
    email: function() {
      return this.emails[0].address;
    },
    roles: function() {
      if (!this.roles) return '<none>';
      return this.roles.join(',');
    }
  });

  ///////////////////////////////////////////////////////////////////////////////
  // local helpers

  var clearNotifications = function() {
    Session.set("adminError", null);
    Session.set("adminInfo", null);
  }

}());