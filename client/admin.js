;(function () {
  "use strict";

///////////////////////////////////////////////////////////////////////////////
// admin

Template.admin.tagSelected = function () {
  return Session.get("selectedTag") ? true : false;
};

Template.admin.errorExists = function () {
  return Session.get("adminError");
};

Template.admin.getError = function () {
  return "Error: " + Session.get("adminError");
};

Template.admin.info = function () {
  return Session.get("adminInfo");
};

Template.admin.rerenderd = function () {
  clearNotifications();
};

Template.admin.events({
  'keypress .search-query' : function(event, template) {
    if (event.which == App.keyCode.ENTER) {
      console.log("search stub for", event.target.value)
      return false;
    }
  },
});

///////////////////////////////////////////////////////////////////////////////
// local helpers

var clearNotifications = function () {
  Session.set("adminError", null);
  Session.set("adminInfo", null);
}

}());
