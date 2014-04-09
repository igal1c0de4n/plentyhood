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

Router.map(function() {
  this.route('land', {path: '/'})
  this.route('land', {path: '/home'})
  this.route('main');
  this.route('about');
  this.route('admin', {
    onBeforeAction: function (pause) {
      if (!Roles.userIsInRole(Meteor.user(), 'admin')) {
        this.render('notfound');
        pause();
      }
    },
  });
  this.route('land', {
    path: '/signout',
    onBeforeAction: function (pause) {
      if (!Meteor.user()) {
        // render the login template but keep the url in the browser the same
        this.render('land');
        // stop the rest of the before hooks and the action function 
        pause();
      }
    },
    action: function () {
      roles.signout();
    },
  });
});
}());
