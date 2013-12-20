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
//

Meteor.startup(function () {

  ////////////////////////////////////////////////////////////////////
  // Create Test Users

  if (Meteor.users.find().fetch().length === 0) {
    console.log('Creating users: ');
    var users = [
        {name:"Normal User",email:"normal@example.com",roles:[]},
        {name:"Manage-Users User",email:"manage@example.com",roles:['manage-users']},
        {name:"Admin User",email:"admin@example.com",roles:['admin']}
      ];
    _.each(users, function (userData) {
      var id,
          user;
      console.log(userData);
      id = Accounts.createUser({
        email: userData.email,
        password: "apple1",
        profile: { name: userData.name }
      });
      // email verification
      Meteor.users.update({_id: id}, {$set:{'emails.0.verified': true}});
      Roles.addUsersToRoles(id, userData.roles);
    });
  }

  ////////////////////////////////////////////////////////////////////
  // Prevent non-authorized users from creating new users

  Accounts.validateNewUser(function (user) {
    var loggedInUser = Meteor.user();
    if (Roles.userIsInRole(loggedInUser, ['admin','manage-users'])) {
      return true;
    }
    throw new Meteor.Error(403, "Not authorized to create new users");
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
  return;
});

}());
