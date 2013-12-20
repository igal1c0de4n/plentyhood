// global app object, cannot "use strict" on it

App = ({

  keyCode: { 
    ENTER: 13, 
    ESCAPE: 27
  },

  init: function () {
    var c = {};
    c.Places = new Meteor.Collection("places");
    c.Tags = new Meteor.Collection("tags");
    
    this.collections = c;
    return this; // chainability
  },
}).init();
