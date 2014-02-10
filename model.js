;(function () {
  "use strict";

// Loaded on both the client and the server

App.collections.Resources.allow({
  insert: function (userId) {
    return false; 
  },
  update: function (userId) {
    return false;
  },
  remove: function (userId) {
    return false;
  },
});

App.collections.Tags.allow({
  insert: function (userId) {
    return false; 
  },
  update: function (userId) {
    return false;
  },
  remove: function (userId) {
    return false;
  },
});

// Places -- data model
/*
  Each place is represented by a document in the Places collection:
    owner: user id
    title, description: String
    public: Boolean
    invited: Array of user id's that are invited (only if !public)
*/
App.collections.Places.allow({
  insert: function (userId, place) {
    return false; // no cowboy inserts -- use mtcPlaceCreate method
  },
  update: function (userId, place, fields, modifier) {
    if (userId !== place.owner)
      return false; // not the owner

    var allowed = ["title", "description", "location", "resources"];
    if (_.difference(fields, allowed).length) {
      // console.log("forbidden fields update", fields);
      return false; // tried to write to forbidden field
    }

    // A good improvement would be to validate the type of the new
    // value of the field (and if a string, the length.) In the
    // future Meteor will have a schema system to makes that easier.
    return true;
  },
  remove: function (userId, place) {
    // You can only remove places that you created
    if (place.owner === userId) {
      return true;
    } 
    var adminUser = Meteor.users.findOne({ "profile.name": "Admin"});
    console.log("user", userId, "admin", adminUser._id)
    return userId == adminUser._id;
  }
});

Meteor.methods({

  mtcIsDevEnv: function() {
    // console.log(process.env);
    if(!this.isSimulation){
      // called from the server
      return server.isDevEnv();
    }
  },

  // options should include: title, description, x, y, public
  mtcPlaceUpdate: function (options) {
    options = options || {};
    if (options.title.length > 100)
      throw new Meteor.Error(413, "Title too long");
    if (options.description.length > 1000)
      throw new Meteor.Error(413, "Description too long");
    verifyLoggedIn.call(this);
    if (options.placeId) {
      // update existing place
      return App.collections.Places.update(options.placeId, { 
        $set: {
          title: options.title,
          description: options.description,
          public: !! options.public,
        }
      });
    } else {
      // new place
      var isInRange = function (v, min, max) {
        return v >= min && v <=max;
      };
      _.each(options.location.coordinates, function (c) {
        if (!isInRange(c, -180, 180))
          throw new Meteor.Error(413, "Bad lat/lng", c);
      });
      return App.collections.Places.insert({
        owner: this.userId,
        location: options.location,
        title: options.title,
        description: options.description,
        public: !! options.public,
        invited: [],
      });
    }
  },

  mtcInvite: function (placeId, userId) {
    var place = App.collections.Places.findOne(placeId);
    if (! place || place.owner !== this.userId)
      throw new Meteor.Error(404, "No such place");
    if (place.public)
      throw new Meteor.Error(400,
                             "That place is public. No need to invite people.");
    if (userId !== place.owner && ! _.contains(place.invited, userId)) {
      App.collections.Places.update(placeId, { $addToSet: { invited: userId } });

      var from = contactEmail(Meteor.users.findOne(this.userId));
      var to = contactEmail(Meteor.users.findOne(userId));
      if (Meteor.isServer && to) {
        // This code only runs on the server. If you didn't want clients
        // to be able to see it, you could move it to a separate file.
        Email.send({
          from: "noreply@example.com",
          to: to,
          replyTo: from || undefined,
          subject: "PLACE: " + place.title,
          text:
"Hey, I just invited you to '" + place.title + "' on All Tomorrow's Places." +
"\n\nCome check it out: " + Meteor.absoluteUrl() + "\n"
        });
      }
    }
  },

  mtcResourceUpdate: function (options) {
    options = options || {};
    verifyLoggedIn.call(this);
    var tagIdsList = _.map(options.tags, function (tagTitle) {
      var t = App.collections.Tags.findOne({title: tagTitle});
      if (t) {
        // bug: only inc popularity if new resource or if tag does not 
        // already exist in resource
        t.popularity++;
        // console.log("tag", tagTitle, "exists, popularity:", t.popularity);
        App.collections.Tags.update(t._id, t);
        return t._id;
      }
      // must be new tag
      // console.log("creating new tag:", tagTitle);
      var newTagId = App.collections.Tags.insert(
        {title: tagTitle.trim().toLowerCase(), popularity: 1});
        return newTagId;
    });
    if (options.title && options.tags.length) {
      var resourceId = options.resourceId;
      if (resourceId) {
        // console.log("updating resource", resourceId);
        App.collections.Resources.update(resourceId, { 
          title: options.title, 
          description: options.description,
          public: options.public,
          tags: tagIdsList,
        });
      }
      else {
        // no resource id -- new resource
        resourceId = App.collections.Resources.insert({
            title: options.title, 
            description: options.description,
            public: options.public,
            tags: tagIdsList,
        });
        // console.log("mtcResourceUpdate->resource", resourceId);
      }
      return resourceId;
    }
    else {
      throw new Meteor.Error(403, "missing options");
    }
  },

  mtcPlaceResourceAdd: function (options) {
    options = options || {};
    verifyLoggedIn.call(this);
    var p = placeGet(options.placeId);
    placeOwnerConfirm.call(this, p);
    var placeId = options.placeId;
    var resourceId = options.resourceId;
    // console.log("mtcPlaceResourceAdd", resourceId, placeId);
    if (placeId && resourceId) {
      App.collections.Places.update(placeId, { 
        $addToSet: { resources: resourceId}
      });
      // console.log("added resource", resourceId, "to place", placeId);
    }
    else {
      throw new Meteor.Error(403, "missing options");
    }
  },

  mtcPlaceResourceRemove: function (options) {
    options = options || {};
    verifyLoggedIn.call(this);
    var placeId = options.placeId;
    var resourceId = options.resourceId;
    var p = placeGet(placeId);
    placeOwnerConfirm.call(this, p);
    if (!placeHasResource(p, resourceId)) {
      throw new Meteor.Error(
        403, "resource", resourceId, "is not in place", placeId);
    }
    else {
      App.collections.Places.update(placeId, {
        $pull: { resources: resourceId }
      });
    }
  }
});

///////////////////////////////////////////////////////////////////////////////

var placeGet = function (placeId) {
  if (!placeId) {
    throw new Meteor.Error(403, "null place id");
  }
  var p = App.collections.Places.findOne(placeId);

  if (!p) {
    throw new Meteor.Error(403, "place not found");
  }
  return p;
}

var placeOwnerConfirm = function (p) {
  if (p.owner !== this.userId) {
    throw new Meteor.Error(403, "unauthorized user");
  }
}

var placeHasResource = function (place, rid) {
  var foundId = _.find(place.resources, function (r) {
    if (r == rid) {
      //         console.log("place has resource", r._id, r.title);
      return true; 
    }
  });
  return !!foundId;
}

var verifyLoggedIn = function () {
  if (! this.userId) {
    throw new Meteor.Error(403, "You must be logged in");
  }
}

// Users

var contactEmail = function (user) {
  if (user.emails && user.emails.length)
    return user.emails[0].address;
  if (user.services && user.services.facebook && user.services.facebook.email)
    return user.services.facebook.email;
  return null;
};

}());
