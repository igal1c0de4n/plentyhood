// global app object, cannot "use strict" on it

App = ({
  init: function () {
    var c = {};
    c.Places = new Meteor.Collection("places");
    c.Tags = new Meteor.Collection("tags");
    c.Resources = new Meteor.Collection("resources");
    
    this.collections = c;
    return this; // chainability
  },
}).init();
