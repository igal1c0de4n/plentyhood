// Places -- data model
// Loaded on both the client and the server

/*
  Each place is represented by a document in the Places collection:
    owner: user id
    x, y: Number (screen coordinates in the interval [0, 1])
    title, description: String
    public: Boolean
    invited: Array of user id's that are invited (only if !public)
    rsvps: Array of objects like {user: userId, rsvp: "yes"} (or "no"/"maybe")
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
    // You can only remove places that you created and nobody is going to.
    return place.owner === userId && attending(place) === 0;
  }
});

attending = function (place) {
  return (_.groupBy(place.rsvps, 'rsvp').yes || []).length;
};

Meteor.methods({
  // options should include: title, description, x, y, public
  createPlace: function (options) {
    options = options || {};
    // NH - validation breaks when trying to use lat lng
    // if (! (typeof options.title === "string" && options.title.length &&
    //        typeof options.description === "string" &&
    //        options.description.length &&
    //        typeof options.x === "number" && options.x >= 0 && options.x <= 1 &&
    //        typeof options.y === "number" && options.y >= 0 && options.y <= 1 ))
    //   throw new Meteor.Error(400, "Required parameter missing");
    if (options.title.length > 100)
      throw new Meteor.Error(413, "Title too long");
    if (options.description.length > 1000)
      throw new Meteor.Error(413, "Description too long");
    if (! this.userId)
      throw new Meteor.Error(403, "You must be logged in");

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
      rsvps: []
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

  rsvp: function (placeId, rsvp) {
    if (! this.userId)
      throw new Meteor.Error(403, "You must be logged in to RSVP");
    if (! _.contains(['yes', 'no', 'maybe'], rsvp))
      throw new Meteor.Error(400, "Invalid RSVP");
    var place = Places.findOne(placeId);
    if (! place)
      throw new Meteor.Error(404, "No such place");
    if (! place.public && place.owner !== this.userId &&
        !_.contains(place.invited, this.userId))
      // private, but let's not tell this to the user
      throw new Meteor.Error(403, "No such place");

    var rsvpIndex = _.indexOf(_.pluck(place.rsvps, 'user'), this.userId);
    if (rsvpIndex !== -1) {
      // update existing rsvp entry

      if (Meteor.isServer) {
        // update the appropriate rsvp entry with $
        Places.update(
          {_id: placeId, "rsvps.user": this.userId},
          {$set: {"rsvps.$.rsvp": rsvp}});
      } else {
        // minimongo doesn't yet support $ in modifier. as a temporary
        // workaround, make a modifier that uses an index. this is
        // safe on the client since there's only one thread.
        var modifier = {$set: {}};
        modifier.$set["rsvps." + rsvpIndex + ".rsvp"] = rsvp;
        Places.update(placeId, modifier);
      }

      // Possible improvement: send email to the other people that are
      // coming to the place.
    } else {
      // add new rsvp entry
      Places.update(placeId,
                     {$push: {rsvps: {user: this.userId, rsvp: rsvp}}});
    }
  }
});

///////////////////////////////////////////////////////////////////////////////
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
