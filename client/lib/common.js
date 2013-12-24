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
};
