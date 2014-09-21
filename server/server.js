// server
server = {
  isDevEnv: function(){
    // console.log("ROOT_URL", process.env.ROOT_URL, "NODE_ENV", process.env.NODE_ENV);
    return process.env.ROOT_URL === "http://localhost:3000/" &&
      // allow command line override with --env=production
      process.env.NODE_ENV === 'development';
  }
};

;(function () {
  "use strict";

Meteor.publish("directory", function () {
  return Meteor.users.find({}, {fields: {emails: 1, profile: 1}});
});

Meteor.publish("userDetails", function () {
  return Meteor.users.find(
    {_id: this.userId},
    {fields: {profile: 1, emails: 1, services: 1}});
});

Meteor.publish("places", function (bounds) {
  if (bounds) {
    var cursor = collections.Places.find({
      location: {$geoWithin : {$box: bounds}},
      $or: [{"public": true}, {invited: this.userId}, {owner: this.userId}]
    });
    // console.log("publishing", cursor.fetch().length, "places", bounds);
    return cursor;
  }
});

Meteor.publish("tags", function () {
  return collections.Tags.find();
});

Meteor.publish("resources", function () {
  return collections.Resources.find();
});

collections.Places._ensureIndex({location : "2dsphere"});
console.log("app in", server.isDevEnv() ? "development" : "staging", "mode");

//------------ db migration code -----------

var dataMassage = function () {
  _.each(collections.Places.find().fetch(), function (p) {
    _.each(p.resources, function (rid) {
      var r = collections.Resources.findOne(rid);
      if (!r.placeId) {
        console.log("set placeId", p._id, "in resource", rid);
        var ret = collections.Resources.update(rid, {$set: {placeId: p._id}});
      } else {
        console.log("placeId", p._id, "already in resource", rid);
      }
    });
  });
  var ret = collections.Resources.update(
    {place: {$exists: true}}, {$unset: {place: 1}}, {multi: true});
  var ret = collections.Resources.remove({placeId: {$exists: false}});
};
// dataMassage();

}());
