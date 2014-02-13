;(function () {
  "use strict";

  // console.log("client starting");
  // this is to prevent static resources from being fetched
  // before the static resources providing method is established
  Session.set("staticContentReady", undefined);
  Session.set("searchTags", undefined);
  // If no place selected, select one.
  Meteor.startup(function () {
    Meteor.call("mtcIsDevEnv", function (error, result) {
      console.log("app in dev mode: ", result);
      client.staticContentPath = result ? "" : "https://s3.amazonaws.com/plentyhood/";
      Session.set("staticContentReady", result);
    });
  });
}());

client = {
  isStaticContentReady: function () {
    return !_.isUndefined(Session.get("staticContentReady"));
  },

  getResourceUrl: function (path) {
    if (_.isUndefined(client.staticContentPath)) {
      throw new Error("access to static url while provider not set");
    }
    // console.log("getResourceUrl", client.staticContentPath, path);
    return client.staticContentPath + path;
  },

  displayName: function (user) {
    if (user.profile && user.profile.name)
      return user.profile.name;
    return user.emails[0].address;
  },

  tagsInputOptions: {
    // TBD: sort by popularity of tag
    minLength: 2,
    maxTags: 12,
    typeahead: {
      source: function(query) {
        var foundTags = App.collections.Tags.
          find({title: new RegExp("^" + query.toLowerCase())}).fetch();
        var tags = _.map(foundTags, function (t) {
          return t.title;
        });
        // console.log("typeahead.source", tags);
        return tags;
      }
    },
    tagClass: function (item) {
      // console.log("tagClass", item);
      var v = item.trim().toLowerCase();
      var o = App.collections.Tags.findOne({title: v});
      return o ? 'label label-primary' : 'label label-warning';
    }
  },

  getMatchingPlaces: function () {
    // TBD: auto calculate from zoom level
    var places = [];
    var tags = Session.get("searchTags");
    var center = Session.get("mapCenter");
    if (tags && tags.length) {
      console.log("getMatchingPlaces->tags", tags);
      var tids = _.map(tags, function (t) {
        var v = t.trim().toLowerCase();
        var o = App.collections.Tags.findOne({title: v});
        return o ? o._id : undefined;
      });
      console.log("tids", tids);
      var missingTags = _.find(tids, function (id) {
        return _.isUndefined(id);
      });
      if (missingTags == undefined) {
        // console.log("all tags found");
        App.collections.Places.find({
          location: {$near : {$geometry: center}, $maxDistance: 5000},
        }).forEach(function (place){
          // console.log("looking in place", place);
          _.map(place.resources, function (rid){
            var resource = App.collections.Resources.findOne(rid);
            var tagsAreMissing = _.find(tids, function(tid){
              var found = _.find(resource.tags, function(t){
                return t === tid;
              });
              return !found;
            });
            if (!tagsAreMissing) {
              // found a resource with all the tags
              // console.log("resource", resource.title, 
              //             "at place", place.title, "meets search criteria!");
              places.push(place);
            }
          })
        });
        // TBD: improve search performance by duplicating place 
        // location in every resource, and using:
        //
        // resources = App.collections.Resources.find({
        //   location: {$near : {$geometry: center}, $maxDistance: ...},
        //   'tags' : {'$all': tids}
        // })
      }
      else {
        // this should be an illegal search, once the tagsinput field
        // prevents inserting non-existant tags
        // TBD: throw error instead
        //
        // some tags are not even in the database 
        // - don't bother with query, no places has those resources
        // console.log("search for non-existing tags!");
        places = [];
      }
    }
    else {
      // backdoor cheat to see all places
      places = App.collections.Places.find({
        location: {$near : {$geometry: center}},
      }).fetch();
      // console.log("search invoked w/o tags");
    }
    // console.log("places", places);
    return places;
  },

  placeSet: function (id) {
    Session.set("placeEditLocation", undefined);
    Session.set("selectedResource", undefined);
    var place = _.isUndefined(id) ? 
      undefined : App.collections.Places.findOne(id);
    Session.set("selectedPlace", place);
  },

  selectedResourceGet: function () {
    var rid = Session.get("selectedResource");
    return rid ? App.collections.Resources.findOne(rid) : undefined; 
  },

  selectedPlaceId: function () {
    var selectedPlace = Session.get("selectedPlace");
    return selectedPlace ? selectedPlace._id : undefined;
  },
};
