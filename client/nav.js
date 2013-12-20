///////////////////////////////////////////////////////////////////////////////
// header

Template.header.userSignedIn = function () {
  return Meteor.userId() ? true : false;
}

Template.header.page2class = function (page, cssClass) {
  if (Meteor.Router.page() == page) {
    console.log("active page", page);
    return cssClass;
  }
  return "";
};
