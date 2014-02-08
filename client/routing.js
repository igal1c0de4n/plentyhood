;(function () {

  "use strict";

////////////////////////////////////////////////////////////////////
// Routing

// override with meteor-router navigate method
Meteor.navigateTo = function (path) {
  Meteor.Router.to(path);
};

function emailVerified (user) {
  return _.some(user.emails, function (email) {
    return email.verified;
  });
}

Meteor.Router.add({
  '/': function () {
//     console.log('router root');
    if (Meteor.loggingIn()) {
//       console.log('home: loading');
      return 'loading';
    }
    var user = Meteor.user();
    if (user) {
//       console.log("user", user);
//        if (!emailVerified(user)) {
//          console.log('home: awaiting-verification');
//          return 'awaiting-verification';
//        }
    }
    return 'landing';
  },

  '/about': 'about',
  '/landing': 'landing',
  '/places': 'places',
  '/admin': function () {
    if (Roles.userIsInRole(Meteor.user(), 'admin')) {
      return 'admin';
    }
    return 'notfound';
  },
  '/signout': App.signout,
  '*': 'notfound',
});

Meteor.Router.filters({
  checkLoggedIn: function (page) {
    var user;
    if (Meteor.loggingIn()) {
      console.log('filter: loading');
      return 'loading';
    } else {
      user = Meteor.user();
      if (!user) {
        console.log('filter: not signed in');
        return 'notfound';
      }
// Disable email verification for now
//       if (!emailVerified(user)) {
//         console.log('filter: awaiting-verification');
//         return 'awaiting-verification';
//       } 
      return page;
    }
  }
});

// make sure user has logged in for all appropriate routes
Meteor.Router.filter('checkLoggedIn', {
  except:['about', 'places', 'loading', 'not-found', 'landing']
});

}());
