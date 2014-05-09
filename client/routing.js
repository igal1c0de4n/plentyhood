;(function () {

  "use strict";

Meteor.navigateTo = function (path) {
  Router.go(path);
};

function emailVerified (user) {
  return _.some(user.emails, function (email) {
    return email.verified;
  });
}

Router.configure({
  layoutTemplate: 'siteLayout',
  notFoundTemplate: 'notFound',
  loadingTemplate: 'loading',
});

Router.map(function() {
  this.route('land', {
    path: '/',
    layoutTemplate: 'land',
  });
  this.route('placesMap');
  this.route('about');
  this.route('signin');
  this.route('admin', {
    onBeforeAction: function (pause) {
      if (!Roles.userIsInRole(Meteor.user(), 'admin')) {
        console.log("user is not an admin");
        this.render('notFound');
        // TBD: uncomment this
        // pause();
      } else {
        console.log("admin confirmed");
      }
    },
  });
});
}());
