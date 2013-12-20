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

Meteor.publish("tags", function () {
  return App.collections.Tags.find();
});

console.log("app env: " + JSON.stringify(process.env.NODE_ENV));

var fixDB = function() {
  _.each(App.collections.Tags.find().fetch(), function (r) {
    console.log("resource", r);
    App.collections.Tags.update(r._id, {name: r.name.toLowerCase()});
  });
};

}());
