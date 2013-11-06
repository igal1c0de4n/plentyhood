// globals, no "use strict" here

Places = new Meteor.Collection("places");
Categories = new Meteor.Collection("categories");
Resources = new Meteor.Collection("resources");
Services = new Meteor.Collection("services");

var categoryExist = function (n) {
  return Categories.find({name: n}).count() != 0;
}

ENTER_KEY = 13;
