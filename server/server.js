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
    return App.collections.Places.find({
      location: {$geoWithin : {$box: bounds}},
      $or: [{"public": true}, {invited: this.userId}, {owner: this.userId}]});
  }
});

Meteor.publish("tags", function () {
  return App.collections.Tags.find();
});

Meteor.publish("resources", function () {
  return App.collections.Resources.find();
});

App.collections.Places._ensureIndex({location : "2dsphere"});
console.log("app in", server.isDevEnv() ? "development" : "staging", "mode");

//------------ db migration code -----------

var dataMassage = function () {
  _.each(App.collections.Places.find().fetch(), function (p) {
    var update = false;
    if (p.hasOwnProperty('coordinates')) { 
      console.log("switching coordiantes to GeoJSON");
      p.location = {
        type: "Point",
        coordinates: [p.coordinates.lng, p.coordinates.lat],
      };
      if (p.hasOwnProperty('coordinates')) {
        delete p.coordinates;
      }
      update = true;
    }
    if (update) {
      console.log("--> updating place", p);
      App.collections.Places.update(p._id, p);
    }
  });
};
// dataMassage();

}());
