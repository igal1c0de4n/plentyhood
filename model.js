// Loaded on both the client and the server

Resources = new Meteor.Collection("resources");
Services = new Meteor.Collection("services");
Categories = new Meteor.Collection("categories");

Categories.allow({
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

Resources.allow({
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
    x, y: Number (screen coordinates in the interval [0, 1])
    title, description: String
    public: Boolean
    invited: Array of user id's that are invited (only if !public)
*/
Places = new Meteor.Collection("places");

Places.allow({
  insert: function (userId, place) {
    return false; // no cowboy inserts -- use createPlace method
  },
  update: function (userId, place, fields, modifier) {
    if (userId !== place.owner)
      return false; // not the owner

    var allowed = ["title", "description", "x", "y", "lat", "lng"];
    if (_.difference(fields, allowed).length)
      return false; // tried to write to forbidden field

    // A good improvement would be to validate the type of the new
    // value of the field (and if a string, the length.) In the
    // future Meteor will have a schema system to makes that easier.
    return true;
  },
  remove: function (userId, place) {
    // You can only remove places that you created
    return place.owner === userId;
  }
});

Meteor.methods({

  getNodeEnv: function() {
    // console.log(process.env);
    if (Meteor.isServer) {
      return JSON.stringify(process.env.NODE_ENV);
    }
  },

  // options should include: title, description, x, y, public
  createPlace: function (options) {
    options = options || {};
    function isInRange(v, min, max) {
      return v >= min && v <=max;
    }
    if (!isInRange(options.lat, -180, 180) ||
       !isInRange(options.lng, -180, 180)) {
      throw new Meteor.Error(413, "Bad lat/lng");
    }
    if (options.title.length > 100)
      throw new Meteor.Error(413, "Title too long");
    if (options.description.length > 1000)
      throw new Meteor.Error(413, "Description too long");
    verifyLoggedIn.call(this);

    return Places.insert({
      owner: this.userId,
      x: options.x,
      y: options.y,
      lat: options.lat,
      lng: options.lng,
      title: options.title,
      description: options.description,
      public: !! options.public,
      invited: [],
    });
  },

  invite: function (placeId, userId) {
    var place = Places.findOne(placeId);
    if (! place || place.owner !== this.userId)
      throw new Meteor.Error(404, "No such place");
    if (place.public)
      throw new Meteor.Error(400,
                             "That place is public. No need to invite people.");
    if (userId !== place.owner && ! _.contains(place.invited, userId)) {
      Places.update(placeId, { $addToSet: { invited: userId } });

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

  categoryAdd: function (options) {
    var CATEGORY_NAME_MAX_LEN = 64;

    options = options || {};

    var n = _(options.name).capitalize();
    if (n.length > CATEGORY_NAME_MAX_LEN)
      throw new Meteor.Error(413, "Name too long");
    verifyLoggedIn.call(this);

    if (categoryExist(n)) {
      throw new Meteor.Error(403, "Already exists");
    }
    // TBD: check for user == admin

    return Categories.insert({ name: n});
  },

  categoryRemove: function (options) {
    if (!options.id)
      throw new Meteor.Error(403, "Empty id");

    verifyLoggedIn.call(this);

    // TBD: check for user == admin

    return Categories.remove({ _id: options.id});
  },

  resourceAdd: function (options) {
    var RESOURCE_NAME_MAX_LEN = 64;

    options = options || {};

    if (options.name.length > RESOURCE_NAME_MAX_LEN)
      throw new Meteor.Error(413, "name too long");
    verifyLoggedIn.call(this);

    // TBD: check for user == admin

    return Resources.insert({
      name: _(options.name).capitalize(),
      categoryId: options.categoryId,
    });
  },

  resourceRemove: function (options) {
    if (!options.id)
      throw new Meteor.Error(413, "Empty id");
    verifyLoggedIn.call(this);

    // TBD: check for user == admin

    return Resources.remove({
      _id: options.id,
    });
  },

  placeResourceAdd: function (options) {
    options = options || {};

    verifyLoggedIn.call(this);

    if (!options.placeId) {
      throw new Meteor.Error(403, "missing place id");
    }
    var place = Places.findOne(options.placeId);

    if (!place || place.owner !== this.userId) {
      throw new Meteor.Error(404, "No such place");
    }

    if (_.contains(place.resources, options.resourceId)) {
      throw new Meteor.Error(404, "resource already exists in place");
    }
    else {
      Places.update(options.placeId, { 
        $addToSet: { 
          resources: { 
            id: options.resourceId, 
            description: options.description,
            public: options.public,  
          }
        }
      });
    }
  },
});

///////////////////////////////////////////////////////////////////////////////

var verifyLoggedIn = function () {
  if (! this.userId) {
    throw new Meteor.Error(403, "You must be logged in");
  }
}

categoryExist = function (n) {
  return Categories.find({name: n}).count() != 0;
}

// Users

displayName = function (user) {
  if (user.profile && user.profile.name)
    return user.profile.name;
  return user.emails[0].address;
};

var contactEmail = function (user) {
  if (user.emails && user.emails.length)
    return user.emails[0].address;
  if (user.services && user.services.facebook && user.services.facebook.email)
    return user.services.facebook.email;
  return null;
};

// extend underscore
_.mixin({
  capitalize: function(string) {
    return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
  }
});

getFromSelectionById = function (selection, id) {
  return selection.findOne({_id: id});
}

ENTER_KEY = 13;
