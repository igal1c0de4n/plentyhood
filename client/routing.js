;(function () {

  "use strict";


////////////////////////////////////////////////////////////////////
// Routing
//

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
    var user;

    console.log('router root');
    if (Meteor.loggingIn()) {
      console.log('home: loading');
      return 'loading';
    }
    user = Meteor.user();
    if (user) {
      console.log('home: user found');
      console.log(user.roles);
       if (!emailVerified(user)) {
         console.log('home: awaiting-verification');
         return 'awaiting-verification';
       }
    }
    console.log('home: start');
    return 'start';
  },
  '/start': 'start',
  '/places': 'places',
  '/secrets': 'secrets',

  '/admin': function () {
    if (Roles.userIsInRole(Meteor.user(), 'admin')) {
      return 'admin';
    }
    return 'notfound';
  },
    
  '/manage': function () {
         console.log('manage route');
    if (Roles.userIsInRole(Meteor.user(), ['admin','manage-users'])) {
      return 'manage';
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
      if (!emailVerified(user)) {

        console.log('filter: awaiting-verification');
        return 'awaiting-verification';

      } 
      console.log('filter: done');
      return page;
    }
  }
});

// make sure user has logged in for all appropriate routes
Meteor.Router.filter('checkLoggedIn', {
  except:['start', 'places', 'loading', 'not-found']
});

}());
