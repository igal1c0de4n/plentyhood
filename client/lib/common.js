client = {

  keyCode: { 
    ENTER: 13, 
    ESCAPE: 27,
    ARROW_UP: 38,
    ARROW_DOWN: 40,
  },

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

  placeSet: function (id) {
    Session.set("placeEditLocation", undefined);
    Session.set("selectedResource", undefined);
    var place = _.isUndefined(id) ? 
      undefined : App.collections.Places.findOne(id);
    var lastPlace = Session.get("selectedPlace");
    Session.set("lastSelectedPlaceId", lastPlace ? lastPlace._id : undefined);
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

  panelsStack: [],

  panelPush: function (panel) {
    // console.log("pushing panel", panel);
    client.panelsStack.push(panel);
    Session.set("panel", panel);
  },

  panelPop: function () {
    var stack = client.panelsStack;
    var prvPanel = stack.pop();
    var currentPanel = stack[stack.length - 1];
    // console.log("poped panel '" + prvPanel + "', current panel '" + currentPanel + "'");
    Session.set("panel", currentPanel);
  },
};

;(function () {
  "use strict";

  // console.log("client starting");
  // this is to prevent static resources from being fetched
  // before the static resources providing method is established
  var unsetList = [
    "staticContentReady",
    "searchTags",
    "placesSearchResults",
    "mapCenter",
    "mapBounds",
  ];
  _.each(unsetList, function (name) {
    Session.set(name, undefined);
  });
  client.panelPush("main");
  // If no place selected, select one.
  Meteor.startup(function () {
    Meteor.call("mtcIsDevEnv", function (error, result) {
      console.log("app in dev mode: ", result);
      client.staticContentPath = result ? "" : "https://s3.amazonaws.com/plentyhood/";
      Session.set("staticContentReady", result);
    });
  });
}());
