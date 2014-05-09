;(function () {

  "use strict";

////////////////////////////////////////////////////////////////////
// Patches

if (!console || !console.log) {
  // stub for IE
  console = { 
    log: function (msg) {
      $('#log').append(msg)
    } 
  };
}

////////////////////////////////////////////////////////////////////
// Startup

Meteor.startup(function () {
  // Create Demo Users
  if (Meteor.users.find().fetch().length === 0) {
    console.log('Creating users: ');
    var users = [
      {name:"user", email:"user@ph.earth", roles: []},
      {name:"admin", email:"admin@ph.earth", roles: ['admin']}
    ];
    _.each(users, function (userData) {
      var id,
      user;
      console.log(userData);
      id = Accounts.createUser({
        email: userData.email,
        password: "sharewme",
        profile: { name: userData.name }
      });
      // email verification
      Meteor.users.update({_id: id}, {$set:{'emails.0.verified': true}});
      Roles.addUsersToRoles(id, userData.roles);
    });
  }
  Accounts.onCreateUser(function (options, user) {
    console.log("onCreateUser options", options);
    console.log("onCreateUser user", user);
    //     user.services = options.services;
    if (options.profile) {
      // store for profile picture etc
      user.profile = options.profile;
    }
    return user;
  });
});

////////////////////////////////////////////////////////////////////
// Publish

// Authorized users can manage user accounts
Meteor.publish("users", function () {
  var user = Meteor.users.findOne({_id:this.userId});
  if (Roles.userIsInRole(user, ["admin","manage-users"])) {
    return Meteor.users.find({}, {fields: {emails: 1, profile: 1, roles: 1}});
  } 
  this.stop();
});

}());
