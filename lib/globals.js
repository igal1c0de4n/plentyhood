// global app object, cannot "use strict" on it

App = ({

  keyCode: { 
    ENTER: 13, 
    ESCAPE: 27
  },

  categoryExist: function (n) {
    return App.collections.Categories.find({name: n}).count() != 0;
  },

  init: function () {
    var c = {};
    c.Places = new Meteor.Collection("places");
    c.Categories = new Meteor.Collection("categories");
    c.Resources = new Meteor.Collection("resources");
    c.Services = new Meteor.Collection("services");
    c.Secrets = new Meteor.Collection('secrets');
    
    this.collections = c;
    return this; // chainability
  },
}).init();
