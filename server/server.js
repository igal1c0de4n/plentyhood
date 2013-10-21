// Places -- server

Meteor.publish("directory", function () {
  return Meteor.users.find({}, {fields: {emails: 1, profile: 1}});
});

Meteor.publish("places", function () {
  return Places.find(
    {$or: [{"public": true}, {invited: this.userId}, {owner: this.userId}]});
});

Meteor.publish("categories", function () {
  return Categories.find();
});

Meteor.publish("resources", function () {
  return Resources.find();
});

Meteor.publish("services", function () {
  return Services.find();
});

console.log("app env: " + JSON.stringify(process.env.NODE_ENV));
