// server

;(function () {
  "use strict";

Meteor.publish("directory", function () {
  return Meteor.users.find({}, {fields: {emails: 1, profile: 1}});
});

Meteor.publish("places", function () {
  return App.collections.Places.find(
    {$or: [{"public": true}, {invited: this.userId}, {owner: this.userId}]});
});

Meteor.publish("categories", function () {
  return App.collections.Categories.find();
});

Meteor.publish("resources", function () {
  return App.collections.Resources.find();
});

Meteor.publish("services", function () {
  return App.collections.Services.find();
});

console.log("app env: " + JSON.stringify(process.env.NODE_ENV));

}());
