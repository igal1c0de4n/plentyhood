///////////////////////////////////////////////////////////////////////////////
// Leaflet Map
///////////////////////////////////////////////////////////////////////////////

var renderCount; // for troubleshooting extra renders
var llmap;

Template.leafletMap.created = function() {
  // TBD: remove once auto-locate and cross session last-location is stored
  var mapViewDefault = { 
    center: { type: "Point", coordinates: [ -121.95751, 37.35024]},
    zoom: 13,
  }; // santa clara

  console.log("template leafletMap created");
  Session.set('mapView', mapViewDefault);
  renderCount = 0;
};

Template.leafletMap.destroyed = function() {
  console.log("leafletmap -> destroyed");
  llmap.remove();
  llmap = undefined;
  this.handlePlacesChanged.stop();
  this.handleMapChanged.stop();
};

Template.leafletMap.rendered = function() {
  var self = this;
  var last = {};
  last.view = {};
  if (renderCount++ > 0) {
    // workaround for meteor-leaflet issue
    console.log("leaflet rendered skip", renderCount);
    return;
  }
  //   console.log("render iteration " + renderCount);
  var view = Session.get('mapView');
  console.log("map center", view.center.coordinates, "zoom", view.zoom);
  var latlng2GeoJson = function (latlng) {
    return {type: "Point", coordinates: [latlng.lng, latlng.lat]};
  };
  var llmapOptions = {
    maxZoom: 16,
    minZoom: 3,
    noWrap: true,
    zoomControl: false,
  };
  llmap = L.map('leaflet-map', llmapOptions).
    setView(L.GeoJSON.coordsToLatLng(view.center.coordinates), view.zoom).
    locate({maximumAge : 1000 * 60, setView: false}).
    whenReady(function () { 
    //console.log("leaflet ready")
  });
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution : 'Tiles: &copy; Esri, National Geographic'
  }).addTo(llmap);
  llmap.addControl(L.control.zoom({position: 'bottomright'}));
  L.control.scale({
    updateWhenIdle: true, metric: false,
  }).addTo(llmap);
  llmap.on('moveend', function(e) {
    var view = {};
    view.zoom = llmap.getZoom();
    view.center = latlng2GeoJson(llmap.getCenter());
    //     console.log('moveend', view.center.coordinates);
    Session.set('mapView', view);
  });
  llmap.on('click', function(e) {
    //     console.log('clicked at', e.latlng);
    // ctrl is meta key to add a new place
    if (e.originalEvent.ctrlKey === true) {
      if(! Meteor.userId()) {
        console.log("must be logged in to create events");
        return;
      }
      schedCreateDialog(latlng2GeoJson(e.latlng));
    }
  });  
  var userLocationMarker;
  llmap.on('locationfound', function(e) {
    var view = {};
    var newLocation = latlng2GeoJson(e.latlng);
    if (!_.objectsEqual(last.view.userLocation, newLocation)) {
      if (userLocationMarker) {
        // remove previous user location
        llmap.removeLayer(userLocationMarker);
      }
      // mark user on the map with circle
      var userLocMarkerOpts = {
        color: 'yellow' /* for blue: '#15f'*/, 
        opacity: 0.9,
        fillOpacity: 0.6,
        radius: 10, 
        stroke: true
      };
      userLocationMarker = 
        new L.CircleMarker(e.latlng, userLocMarkerOpts);
      userLocationMarker.addTo(llmap);
//       console.log("updated current location marker to", e.latlng.toString());
      view.userLocation = newLocation;
    }
    // pan the map to user location
    view.center = newLocation;
    view.zoom = 15;
    console.log('locationfound:', newLocation.coordinates);
    Session.set('mapView', view);
  });
  llmap.on('locationerror', function(e) {
    console.log('locationerror: ' + e.message + " " + e.code);
  });
  // closure vars
  var markers = [];
  // control all markers via a single layer
  var markerLayer = L.layerGroup().addTo(llmap);
  var staticRoot = "https://s3.amazonaws.com/plentyhood/"
  var leafletStaticFolder = staticRoot + "leaflet/images/";
  var markerIcon = L.icon({
    iconUrl: leafletStaticFolder + "marker-icon.png",
    shadowUrl: leafletStaticFolder + "marker-shadow.png",
    iconAnchor: [12, 41], // half width, full length of marker-icon.png
  });
  var markerUnselectedStyle = {
    icon: markerIcon,
    riseOnHover: true, 
    opacity: 0.5,
  };
  var markerSelectedStyle = {
    icon: markerIcon,
    riseOnHover: true,
  };
  this.handlePlacesChanged = Deps.autorun(function () {
    // bth map recenter and tags trigger a new search
    var places = client.getMatchingPlaces(
      Session.get("mapView").center,
      Session.get("searchTags"));
    //     console.log("handlePlacesChanged", places);
    // before redawing markers, delete the current ones
    // TBD optimization: update only the markers which change
    _.each(markers, function (c) {
      markerLayer.removeLayer(c);
    });
    markers = [];
    // TDB: move selectedPlace to a new Deps.autorun as there's no
    // need to refilter and search for places when selected place 
    // changes. Just redraw two markers
    var selected = Session.get("selectedPlace");
    last.selectedPlace = selected;
    _.each(places, function (place) {
      var latlng = L.GeoJSON.coordsToLatLng(place.location.coordinates);
      var style = selected == place._id ? 
        markerSelectedStyle : markerUnselectedStyle;
      var m = L.marker(latlng, style).addTo(markerLayer);
      m.placeId = place._id;
      m.on('click', function(e) {
        Session.set("selectedPlace", this.placeId);
      });
      markers.push(m);
    });
  });
  this.handleMapChanged = Deps.autorun(function () {
    var view = Session.get('mapView');
    if (!_.objectsEqual(last.view, view)) {
      llmap.setView(L.GeoJSON.coordsToLatLng(view.center.coordinates), view.zoom);
    }
    last.view = view;
  });
};

var schedCreateDialog = function (geoJsonLoc) {
  Session.set("placeLocation", geoJsonLoc);
  Session.set("createError", null);
  Session.set("activeDialog", "placeCreate");
};
