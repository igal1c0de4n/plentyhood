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

// fixdb - massage db here
// function() {
//   _.each(App.collections.Places.find().fetch(), function (p) {
//     var update = false;
//     if (p.hasOwnProperty('lng')) { 
//       console.log("fixing coordiantes");
//       p.coordinates = {lat: p.lat, lng: p.lng};
//       if (p.hasOwnProperty('lng')) delete p.lng;
//       if (p.hasOwnProperty('lat')) delete p.lat;
//       update = true;
//     }
//     if (p.hasOwnProperty('x')) {
//       delete p.x;
//       update = true;
//     }
//     if (p.hasOwnProperty('y')) {
//       delete p.y;
//       update = true;
//     }
//     if (p.hasOwnProperty('rsvps')) {
//       delete p.rsvps;
//       update = true;
//     }
//     if (update) {
//       console.log("--> updating place", p);
//       App.collections.Places.update(p._id, p);
//     }
//   });
// };
}());
