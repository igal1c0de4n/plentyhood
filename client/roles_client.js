roles = {};

;(function () {

  "use strict";


////////////////////////////////////////////////////////////////////
// Patches

// stubs for IE
if (!window.console) {
  window.console = {}
}

if (!window.console.log) {
  window.console.log = function (msg) {
    $('#log').append('<br /><p>' + msg + '</p>')
  };
}

// fix bootstrap dropdown unclickable issue on iOS
// https://github.com/twitter/bootstrap/issues/4550
$(document).on('touchstart.dropdown.data-api', '.dropdown-menu', function (e) {
    e.stopPropagation();
});

////////////////////////////////////////////////////////////////////
// Subscriptions

Deps.autorun(function () {
  // register dependency on user so subscriptions
  // will update once user has logged in
  var user = Meteor.user();

  // users, for manage-users page
  Meteor.subscribe('users');
});

////////////////////////////////////////////////////////////////////
// header

Template.header.rolesDispName = function (user) {
  var name;
  if (!user) {
    user = Meteor.user();
  }
  if (!user) return "<missing user>";
  if (user.profile) {
    name = user.profile.name;
  }
  name = 'string' === typeof name ? name.trim() : null;
  if (!name && user.emails && user.emails.length > 0) {
    name = user.emails[0].address;
  }
  return name || "<missing name>";
}
}());
