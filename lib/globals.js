// global app object, cannot "use strict" on it

collections = ({
  init: function () {
    this.Places = new Meteor.Collection("places");
    this.Tags = new Meteor.Collection("tags");
    this.Resources = new Meteor.Collection("resources");
    return this; // chainability
  },
}).init();
