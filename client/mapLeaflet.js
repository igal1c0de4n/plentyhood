mapProvider = {};
(function() {
  "use strict";
  var map = {
    debug: {},
    handle: undefined,
    renderCount: undefined, // for troubleshooting extra renders
    defaultZoom: 12,
    minZoomForMarkers: 12,
    minZoom: 3,
    maxZoom: 16, // server does not serve higher zoom level
    selectedPlaceOpacity: 1,
    unselectedPlaceOpacity: 0.5,
    ancientLevantGJ: {
      type: "Point",
      // Jerusalem, "cradle of man kind" :)
      coordinates: [35.21873474121094, 31.78669746847703],
    },
    isCloseEnough: function(c1, c2) {
      var isInRange = function(n1, n2, delta) {
          return (n1 - delta) <= n2 && n2 <= (n1 + delta);
        }
        // Determined by experimenting with leaflet map. 
        // Not very scientific, I know
      var d = 0.001;
      return isInRange(c1[0], c2[0], d) && isInRange(c1[1], c2[1], d);
    },
    latlng2GeoJson: function(latlng) {
      return {
        type: "Point",
        coordinates: [latlng.lng, latlng.lat]
      };
    },
    zoomSet: function(zoom) {
      map.handle.setZoom(zoom);
      var ze = zoom >= map.minZoomForMarkers;
      // console.log("setting mapZoomedEnough", ze, zoom);
      Session.set("mapZoomedEnough", ze);
    },
    updateMapBounds: function() {
      var b = map.handle.getBounds();
      // increase size of bounds by phi for more fluent user experience
      var kmPerDegree = 111.2;
      var marginKm = 1;
      var phi = marginKm / kmPerDegree;
      var bounds = [
        [b.getWest() - phi, b.getSouth() - phi],
        [b.getEast() + phi, b.getNorth() + phi],
      ];
      if (Session.get("drawBounds")) {
        // debug 
        if (map.debug.rect) {
          map.handle.removeLayer(map.debug.rect);
          delete map.debug.rect;
        }
        var rb = L.latLngBounds(
          L.latLng(bounds[0][1], bounds[0][0]),
          L.latLng(bounds[1][1], bounds[1][0])
        );
        map.debug.rect = L.rectangle(rb, {
          color: "#ff7800",
          weight: 2
        }).addTo(map.handle);
      }
      // console.log("bounds", bounds, b);
      Session.set("mapBounds", bounds);
    },
    moveEnd: function(e) {
      var zoom = map.handle.getZoom();
      var center = {
        // last: Session.get("mapCenter"),
        current: map.latlng2GeoJson(map.handle.getCenter()),
        next: Session.get('mapNextCenter'),
      };
      var coordsGet = function(c) {
          return c ? c.coordinates : undefined;
        }
        // console.log('map moveend', zoom, 
        //             coordsGet(center.last), 
        //             coordsGet(center.current), 
        //             coordsGet(center.next));
      map.zoomSet(zoom);
      Session.set('mapCenter', center.current);
      var closeEnough = center.next ?
        map.isCloseEnough(center.next.coordinates, center.current.coordinates) : false;
      if (closeEnough) {
        Session.set('mapNextCenter', undefined);
        // console.log('map next center move is complete');
        if (Session.get('animateCurrentLocation')) {
          // console.log("animating auto locate");
        }
        if (map.userLocation) {
          map.markUserLocation();
        }
      }
      map.updateMapBounds();
    },
    markUserLocation: function() {
      // remove previous user location, if exists
      if (map.userLocationMarker) {
        map.handle.removeLayer(map.userLocationMarker);
      }
      // mark user on the map with circle
      var userLocMarkerOpts = {
        color: 'yellow' /* for blue: '#15f'*/ ,
        opacity: 0.9,
        fillOpacity: 0.6,
        stroke: true,
        clickable: true,
        radius: 10,
        radiusMaxFactor: 6,
        animateFactor: 0.1,
        animateStepMs: 15,
      };
      var currRadius = userLocMarkerOpts.radius;
      var direction = 'grow';
      // console.log("animating user location", this.userLocation.coordinates);
      var latlng = L.GeoJSON.coordsToLatLng(this.userLocation.coordinates);
      map.userLocationMarker = new L.CircleMarker(latlng, userLocMarkerOpts);
      L.featureGroup([map.userLocationMarker])
        .bindPopup('Your detected location')
        .on('click', function() {
          // console.log('location marker clicked'); 
        });
      map.userLocationMarker.addTo(map.handle);
      var maxRadius = userLocMarkerOpts.radiusMaxFactor *
        userLocMarkerOpts.radius;
      var intervalFuncId = Meteor.setInterval(function() {
        // console.log("animate location marker", currRadius);
        if (currRadius > maxRadius) {
          direction = 'shrink';
        }
        if (direction === 'grow') {
          currRadius = Math.floor(
            currRadius * (1 + userLocMarkerOpts.animateFactor));
        } else {
          currRadius = Math.floor(
            currRadius * (1 - userLocMarkerOpts.animateFactor));
          if (currRadius <= userLocMarkerOpts.radius) {
            Meteor.clearInterval(intervalFuncId);
            return;
          }
        }
        map.userLocationMarker.setRadius(currRadius);
      }, userLocMarkerOpts.animateStepMs);
    },
    locationFound: function(e) {
      // console.log("location found");
      var newLocation = map.latlng2GeoJson(e.latlng);
      if (_.isEqual(map.userLocation, newLocation)) {
        // console.log("user location already set at detected location");
      } else {
        // console.log("shifting map center to current location");
        // console.log("updated current loc marker to", e.latlng.toString());
        map.userLocation = newLocation;
      }
      map.locateEnd(true, newLocation, map.defaultZoom);
      Session.set("searchTrigger", true);
    },
    locateEnd: function(locateSuccess, loc, zoom) {
      Session.set("userLocateTrigger", false);
      // map.zoomSet(zoom);
      var mc = Session.get('mapCenter');
      var closeEnough = mc ?
        map.isCloseEnough(mc.coordinates, loc.coordinates) : false;
      if (closeEnough) {
        map.markUserLocation();
      } else {
        // console.log("pan the map to user location");
        mapProvider.centerSet(true, loc, zoom);
        Session.set('locationAvailable', locateSuccess);
      }
      // console.log(
      //   'location', locateSuccess ? 'found' : 'unavailable', 
      //   loc, 'zoom', zoom);
      if (Session.get("panel") == "pLocate") {
        panels.pop();
      }
      if (Session.get("panel") != "pBegin") {
        panels.push("pBegin");
      }
    },
    placeDragSet: function(action) {
      var updatePlaceCoords = function(id, c) {
        collections.Places.update({
          _id: id
        }, {
          $set: {
            'location.coordinates': c
          }
        });
      };
      //     console.log("markers", map.markers);
      var placeId = client.selectedPlaceId();
      var lm = map.markers.getItem(placeId).lmark;
      if (action == "edit") {
        //       console.log("enable marker drag", lm);
        // store original coords in case user cancels
        map.coordsBeforeDrag = lm.toGeoJSON().geometry.coordinates;
        lm.on('dragend', function(e) {
          var coords = this.toGeoJSON().geometry.coordinates;
          //         console.log("marker", this, "moved to", coords);
          updatePlaceCoords(this.placeId, coords);
        });
        lm.dragging.enable();
      } else {
        lm.dragging.disable();
        lm.off('dragend', undefined);
        if (action == "cancel") {
          var sameLocation =
            _.isEqual(lm.toGeoJSON().geometry.coordinates, map.coordsBeforeDrag);
          if (!sameLocation) {
            // console.log("restoring previous coordinates", map.coordsBeforeDrag);
            updatePlaceCoords(placeId, map.coordsBeforeDrag);
            lm.setLatLng(L.GeoJSON.coordsToLatLng(map.coordsBeforeDrag));
          }
          delete map.coordsBeforeDrag;
        }
      }
    },
  };

  Template.leafletMap.created = function() {
    // console.log("template leafletMap created");
    map.renderCount = 0;
    map.canRender = true;
    map.markers = new HashTable();
    map.markerStyle = undefined;
    Session.set('mapCenter', undefined);
    Session.set('mapNextCenter', undefined);
    Session.set('mapBounds', undefined);
    this.handleStaticContent = Deps.autorun(function() {
      if (client.isStaticContentReady()) {
        var path = client.getResourceUrl("img/leaflet/");
        var markerIcon = L.icon({
          iconUrl: path + "marker-icon.png",
          shadowUrl: path + "marker-shadow.png",
          iconAnchor: [12, 41], // half width, full length of marker-icon.png
        });
        map.markerStyle = {
          icon: markerIcon,
          riseOnHover: true,
        };
      }
    });
    this.handlePlacesChanged = Deps.autorun(function() {
      var removeMarkers = function() {
        map.markers.each(function(k, m) {
          map.markerLayer.removeLayer(m.lmark);
        });
        map.markers.clear();
      };
      var updateMarkers = function() {
        if (!Session.get('mapCenter')) {
          // map not yet ready
          return;
        }
        // map recenter and tags trigger a new search
        var places = Session.get("placesSearchResults");
        // console.log("updateMarkers", places);
        // before redawing markers, delete the current ones
        // TBD optimization: update only the markers which change
        //
        // TDB: move selectedPlace to a new Deps.autorun as there's no
        // need to refilter and search for places when selected place 
        // changes. Just redraw two markers
        var selected = client.selectedPlaceId();
        map.markers.each(function(k, m) {
          // default is not keep markers. Kept makers will be specifically marked
          m.keep = false;
        });
        _.each(places, function(p) {
          // check if place is alerady on map
          var id = p._id;
          var m = map.markers.getItem(id);
          if (m) {
            // place p is already marked on map, preserve existing marker
            m.keep = true;
          } else {
            // no marker for place yet
            var m = {};
            var latlng = L.GeoJSON.coordsToLatLng(p.location.coordinates);
            m.lmark = L.marker(latlng, map.markerStyle).addTo(map.markerLayer);
            m.lmark.placeId = id;
            // console.log("setting popup", p.title);
            m.lmark.bindPopup(
              L.popup().setContent(p.title), {
                offset: L.point(1, -19)
              });
            m.lmark.on('click', function(e) {
              // console.log("selected place", this.placeId)
              client.placeSet(this.placeId);
              panels.push("place");
            });
            m.keep = true;
            map.markers.setItem(id, m);
          }
          var opacity = selected == id ?
            map.selectedPlaceOpacity : map.unselectedPlaceOpacity;
          if (selected == id) {
            m.lmark.openPopup();
          } else {
            m.lmark.closePopup();
          }
          m.lmark.setOpacity(opacity);
        });
        // cleanup - remove markers for all places which 
        // disappeared from the map
        var removedMarkers = [];
        map.markers.each(function(k, m) {
          if (!m.keep) {
            // add to list makers
            // TBD: check if can removeItem here
            removedMarkers.push(m);
          }
        });
        _.each(removedMarkers, function(m) {
          map.markerLayer.removeLayer(m.lmark);
          map.markers.removeItem(m.lmark.placeId);
        });
      };
      var ze = Session.get("mapZoomedEnough");
      // if (subscriptions.multiReady(["places", "resources", "tags"])) {
      if (ze) {
        updateMarkers();
      } else {
        removeMarkers();
      }
      // }
    });

    this.handleUserLocate = Deps.autorun(function() {
      if (!Session.get("userLocateTrigger")) {
        return;
      }
      if (map.handle) {
        Meteor.setTimeout(function() {
          if (Session.get("userLocateTrigger")) {
            // console.log("search is still in progress, displaying locate panel");
            panels.push("pLocate");
          }
        }, 500);
        // console.log("running auto locate");
        map.handle.locate({
          maximumAge: 1000 * 60,
          setView: false
        });
      } else {
        // console.warn("map not ready!");
        Session.set("userLocateTrigger", false);
      }
    });

    mapProvider.centerSet = function(animate, center, zoom) {
      if (!map.handle) {
        // console.error("map not initialized");
        return;
      }
      var mc = Session.get('mapCenter');
      if (mc && map.isCloseEnough(mc.coordinates, center.coordinates)) {
        Session.set('mapNextCenter', undefined);
        // console.log('center set: requested center already set');
        return;
      }
      // console.log('center set', center.coordinates);
      if (Session.get('mapNextCenter')) {
        // console.info("center set: recenter already in progress");
        return;
      }
      Session.set('mapNextCenter', center);
      var wrapLongitude = function(d) {
        // this is kind of a hack to keep the map and all markers 
        // between [-180,180] so that GeoLocation db APIs work
        if (d > 180) {
          d -= 360;
        }
        if (d < -180) {
          d += 360;
        }
        return d;
      };
      center.coordinates[0] = wrapLongitude(center.coordinates[0]);
      var llCoord = L.GeoJSON.coordsToLatLng(center.coordinates);
      map.handle.setView(llCoord, zoom, {
        animate: animate
      });
      map.updateMapBounds();
    };
  };

  Template.leafletMap.destroyed = function() {
    map.canRender = false;
    // console.log("template leafletMap destroyed");
    if (map.handle) {
      map.handle.remove();
      map.handle = undefined;
    }
    this.handlePlacesChanged.stop();
    this.handleStaticContent.stop();
    this.handleUserLocate.stop();
  };

  Template.leafletMap.rendered = function() {
    if (map.renderCount++ > 0) {
      // workaround for meteor-leaflet issue
      // console.warn("leaflet rendered skip", map.renderCount);
      return;
    }
    if (!map.canRender) {
      // console.error("leaflet rendered called while template is destroyed! skipping");
      return;
    }
    //   console.log("render iteration " + map.renderCount);
    var initOptions = {
      maxZoom: map.maxZoom,
      minZoom: map.minZoom,
      zoomControl: false,
      markerZoomAnimation: true,
      keyboard: false,
    };
    // console.log("creating map handle");
    map.handle = L.map('leaflet-map', initOptions).whenReady(function() {
      //console.log("leaflet ready")
    });
    L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: map.maxZoom,
      attribution: 'Tiles: &copy; Esri'
    }).addTo(map.handle);
    map.handle.addControl(L.control.zoom({
      position: 'bottomright'
    }));
    L.control.scale({
      updateWhenIdle: true,
      metric: false,
    }).addTo(map.handle);
    map.handle.on('dragend', function(e) {
      Session.set("searchTrigger", true);
    });
    map.handle.on('moveend', map.moveEnd);
    map.handle.on('click', function(e) {
      //     console.log('clicked at', e.latlng);
      // ctrl is meta key to add a new place
      if (e.originalEvent.ctrlKey === true) {
        if (!Meteor.userId()) {
          alert("must be logged in to create place");
          return;
        }
        schedCreateDialog(map.latlng2GeoJson(e.latlng));
      }
    });
    map.handle.on('locationfound', map.locationFound);
    map.handle.on('locationerror', function(e) {
      map.locateEnd(false, map.ancientLevantGJ, map.minZoom);
    });
    // console.log("trigger first auto-locate");
    Session.set("userLocateTrigger", true);
    // control all markers via a single layer
    map.markerLayer = L.layerGroup().addTo(map.handle);
  };

  var schedCreateDialog = function(geoJsonLoc) {
    client.placeSet();
    Session.set("placeLocation", geoJsonLoc);
    Session.set("createError", null);
    Session.set("activeDialog", "placeEdit");
  };

}());