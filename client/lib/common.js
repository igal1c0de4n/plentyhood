client = {
  displayName: function (user) {
    if (user.profile && user.profile.name)
      return user.profile.name;
    return user.emails[0].address;
  },

  tagsInputOptions: function () {
    // TBD: sort by popularity of tag
    return {
      maxTags: 12,
      typeahead: {
        source: function(query) {
          var foundTags = App.collections.Tags.
            find({title: new RegExp("^" + query.toLowerCase())}).
            fetch();
          var tags = _.map(foundTags, function (t) {
            return t.title;
          });
          //           console.log("typeahead.source", tags);
          return tags;
        }
      },
      tagClass: function (item) {
        console.log("tagClass", item);
        var v = item.trim().toLowerCase();
        var o = App.collections.Tags.findOne({title: v});
        return o ? 'label label-info' : 'label label-warning';
      }
    };
  },

  getMatchingPlaces: function (center, tags) {
    // TBD: auto calculate from zoom level
    var distance = 5000; // meters, since we're working with GeoJSON
    var places;
    if (tags && tags.length) {
      //       console.log("tags", tags);
      var ids = _.map(tags, function (t) {
        var v = t.trim().toLowerCase();
        var o = App.collections.Tags.findOne({title: v});
        return o ? o._id : undefined;
      });
      //         console.log("ids", ids);
      var missingTags = _.find(ids, function (id) {
        return id === undefined;
      });
      if (missingTags == undefined) {
        // all tags found
        places = App.collections.Places.find({
          // note: in the example at http://docs.mongodb.org 
          // the location of the curly braces is wrong -
          // it excludes $maxDistance
          location: {$near : {$geometry: center, $maxDistance: distance}},
          'resources.tags' : {'$all': ids}
        }).fetch();
      }
      else {
        // some tags are not even in the database 
        // - don't bother with query, no places has those resources
        places = [];
      }
    }
    else {
      console.log("search invoked w/o tags");
      // backdoor cheat to see all places
      places = App.collections.Places.find({
        location: {$near : {$geometry: center, $maxDistance: distance}}}).fetch();
    }
    //   console.log("places:", places);
    return places;
  },
};
