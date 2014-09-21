client = {

  keyCode: {
    ENTER: 13,
    ESCAPE: 27,
    ARROW_UP: 38,
    ARROW_DOWN: 40,
  },

  isStaticContentReady: function() {
    return !_.isUndefined(Session.get("staticContentPath"));
  },

  getResourceUrl: function(path) {
    if (!this.isStaticContentReady()) {
      throw new Error("access to static url while provider not set");
    }
    var scp = Session.get("staticContentPath");
    // console.log("getResourceUrl", scp, path);
    return scp + path;
  },

  displayName: function(user) {
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
        var foundTags = collections.Tags.
        find({
          title: new RegExp("^" + query.toLowerCase())
        }).fetch();
        var tags = _.map(foundTags, function(t) {
          return t.title;
        });
        // console.log("typeahead.source", tags);
        return tags;
      }
    },
    tagClass: function(item) {
      // console.log("tagClass", item);
      var v = item.trim().toLowerCase();
      var o = collections.Tags.findOne({
        title: v
      });
      return o ? 'label label-primary' : 'label label-warning';
    }
  },

  placeSet: function(id) {
    Session.set("placeEditLocation", undefined);
    Session.set("selectedResource", undefined);
    var place = _.isUndefined(id) ?
      undefined : collections.Places.findOne(id);
    var lastPlace = Session.get("selectedPlace");
    Session.set("lastSelectedPlaceId", lastPlace ? lastPlace._id : undefined);
    Session.set("selectedPlace", place);
  },

  selectedResourceGet: function() {
    var rid = Session.get("selectedResource");
    return rid ? collections.Resources.findOne(rid) : undefined;
  },

  selectedPlaceId: function() {
    var selectedPlace = Session.get("selectedPlace");
    return selectedPlace ? selectedPlace._id : undefined;
  },

  sessionUnsetList: function(list) {
    _.each(list, function(name) {
      // console.log("Session unset", name);
      Session.set(name, undefined);
    });
  },
};

///////////////////////////////////////////////////////////////////////////////
// subscriptions

subscriptions = {
  subs: [],
  multiAdd: function(list, cb) {
    _.each(list, function(arg) {
      if (_.isArray(arg)) {
        // console.log("subscribing with arguments", arg)
        // assuming first arg is the name string
        var name = arg[0]
        this.subs[name] = Meteor.subscribe.apply(Meteor.subscribe, arg, cb);
      } else {
        this.subs[arg] = Meteor.subscribe(arg, cb);
      }
    }.bind(this));
  },
  multiRemove: function(list) {
    _.each(list, function(name) {
      if (!this.subs[name]) {
        throw new Error("uninitialized subscription");
      }
      this.subs[name].stop();
      this.subs[name] = undefined;
    }.bind(this))
  },
  multiReady: function(list) {
    var notReady = _.find(list, function(name) {
      var s = this.subs[name];
      return !s || !s.ready();
    }.bind(this));
    return !notReady;
  },
};

///////////////////////////////////////////////////////////////////////////////
// init

;
(function() {
  "use strict";

  // console.log("client starting");
  // this is to prevent static resources from being fetched
  // before the static resources providing method is established
  // must be run before Meteor.startup
  var sessionVars = [
    "staticContentPath",
  ];
  client.sessionUnsetList(sessionVars);
  Meteor.startup(function() {
    Meteor.call("mtcIsDevEnv", function(error, result) {
      console.log("app in dev mode: ", result);
      Session.set("staticContentPath",
        result ? "" : "https://s3.amazonaws.com/plentyhood/");
    });
    subscriptions.multiAdd(["directory", "userDetails"]);
  });
}());