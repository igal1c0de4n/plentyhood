///////////////////////////////////////////////////////////////////////////////
// Leaflet Map
///////////////////////////////////////////////////////////////////////////////

var map = {
  handle: undefined,
  renderCount: undefined, // for troubleshooting extra renders
  defaultZoom: 15,
  minZoomForMarkers: 13,
  maxZoom: 16, // server does not serve higher zoom level
  defaultCenter: {
    // TBD: remove once auto-locate and cross-session last-location is stored
    // GeoJson for santa clara
    type: "Point", coordinates: [ -121.95751, 37.35024]
  },
};

Template.leafletMap.created = function() {
  console.log("template leafletMap created");
  Session.set('mapCenter', map.defaultCenter);
  Session.set("mapZoom", map.defaultZoom);
  map.renderCount = 0;
};

Template.leafletMap.destroyed = function() {
  console.log("leafletmap -> destroyed");
  map.handle.remove();
  map.handle = undefined;
  this.handlePlacesChanged.stop();
  this.handleMapChanged.stop();
  this.handleZoomChanged.stop();
};

Template.leafletMap.rendered = function() {
  var self = this;
  var last = {};
  last.center = {};
  if (map.renderCount++ > 0) {
    // workaround for meteor-leaflet issue
    //     console.log("leaflet rendered skip", map.renderCount);
    return;
  }
  //   console.log("render iteration " + map.renderCount);
  var coords = Session.get("mapCenter").coordinates;
  console.log("map center", coords, "zoom", Session.get("mapZoom"));
  var latlng2GeoJson = function (latlng) {
    return {type: "Point", coordinates: [latlng.lng, latlng.lat]};
  };
  var areMapPlacesVisible = function (zoom) { 
    return zoom >= map.minZoomForMarkers;
  }
  var initOptions =  {
    maxZoom: map.maxZoom,
    minZoom: 3,
    noWrap: true,
    zoomControl: false,
    markerZoomAnimation: false,
  };
  map.handle = L.map('leaflet-map', map.initOptions).
    setView(L.GeoJSON.coordsToLatLng(coords), Session.get("mapZoom")).
    locate({maximumAge : 1000 * 60, setView: false}).
    whenReady(function () { 
    //console.log("leaflet ready")
  });
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: map.maxZoom,
    attribution : 'Tiles: &copy; Esri, National Geographic'
  }).addTo(map.handle);
  map.handle.addControl(L.control.zoom({position: 'bottomright'}));
  L.control.scale({
    updateWhenIdle: true, metric: false,
  }).addTo(map.handle);
  map.handle.on('moveend', function(e) {
    var zoom = map.handle.getZoom();
    Session.set("mapZoom", zoom);
    //     console.log('map moveend', latlng2GeoJson(map.handle.getCenter()), zoom);
    Session.set('mapCenter', latlng2GeoJson(map.handle.getCenter()));
  });
  map.handle.on('click', function(e) {
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
  map.handle.on('locationfound', function(e) {
    var newLocation = latlng2GeoJson(e.latlng);
    if (!_.objectsEqual(last.userLocation, newLocation)) {
      if (userLocationMarker) {
        // remove previous user location
        map.handle.removeLayer(userLocationMarker);
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
      userLocationMarker.addTo(map.handle);
//       console.log("updated current loc marker to", e.latlng.toString());
      last.userLocation = newLocation;
    }
    // pan the map to user location
    Session.set("mapZoom", map.defaultZoom);
    Session.set('mapCenter', newLocation);
    console.log('locationfound:', newLocation.coordinates);
  });
  map.handle.on('locationerror', function(e) {
    console.log('locationerror',e.message, e.code);
  });
  // closure vars
  var markers = [];
  // control all markers via a single layer
  var markerLayer = L.layerGroup().addTo(map.handle);
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
    var removeMarkers = function () {
        _.each(markers, function (c) {
          markerLayer.removeLayer(c);
        });
        markers = [];
    };
    if (Session.get("mapZoomedEnough")) {
      // map recenter and tags trigger a new search
      var places = client.getMatchingPlaces(
        Session.get("mapCenter"), Session.get("searchTags"));
        //     console.log("handlePlacesChanged", places);
        // before redawing markers, delete the current ones
        // TBD optimization: update only the markers which change
        removeMarkers();
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
    }
    else {
      removeMarkers();
    }
  });
  this.handleMapChanged = Deps.autorun(function () {
    var center = Session.get('mapCenter');
    var zoom = Session.get('mapZoom');
    if (center && !_.objectsEqual(last.center, center)) {
      map.handle.setView(
        L.GeoJSON.coordsToLatLng(center.coordinates),
        zoom);
    }
    last.center = center;
  });

  this.handleZoomChanged = Deps.autorun(function () {
    Session.set("mapZoomedEnough",
      areMapPlacesVisible(Session.get("mapZoom")));
  });
};

var schedCreateDialog = function (geoJsonLoc) {
  Session.set("placeLocation", geoJsonLoc);
  Session.set("createError", null);
  Session.set("activeDialog", "placeCreate");
};
