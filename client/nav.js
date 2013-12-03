///////////////////////////////////////////////////////////////////////////////
// header

Template.header.userSignedIn = function () {
  return Meteor.userId() ? true : false;
}

Template.header.events({
  'keypress .search-query' : function(event, template) {
    if (event.which == App.keyCode.ENTER) {
      if (event.target.value) {
        var v = $.trim(event.target.value);
        regex = new RegExp("\\b" + v + "\\b", "i");
        console.log("search", v, regex);
        var res = App.collections.Places.find({title: regex});
//         var res = App.collections.Places.find({title: v});
        console.log("places search result: ", res.fetch());
        res = App.collections.Resources.find({name: regex});
        console.log("resources search result: ", res.fetch());
      }
      return false;
    }
  },
});