///////////////////////////////////////////////////////////////////////////////
// header

Template.header.page2class = function(page, cssClass) {
  var rc = Router.current();
  if (rc && rc.path == ("/" + page)) {
    //     console.log("active page", page);
    return cssClass;
  }
  return "";
};

Template.header.getFbUser = function() {
  var user = Meteor.user();
  //console.log("getFbUser", user);
  var s = user.services;
  return s && s.facebook ? s.facebook.username : undefined;
};

Template.header.isFullScreen = function() {
  // return Session.get("isFullScreen");
  // or - directly query the window state:
  return document.fullscreenElement || // alternative standard method
    document.mozFullScreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement; // current working methods
};

function enterFullScreen() {
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen();
  } else if (document.documentElement.msRequestFullscreen) {
    document.documentElement.msRequestFullscreen();
  } else if (document.documentElement.mozRequestFullScreen) {
    document.documentElement.mozRequestFullScreen();
  } else if (document.documentElement.webkitRequestFullscreen) {
    document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
  }
};

function exitFullScreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
};

Template.header.events({
  'click #fullscreen-on': function() {
    enterFullScreen();
  },
  'click #fullscreen-off': function() {
    exitFullScreen();
  },
  'click #signout': function() {
    Meteor.logout(function() {
      console.log("signed out");
    });
  },
});