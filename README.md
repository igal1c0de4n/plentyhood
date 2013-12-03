Plentyhood
==========
This web application builds on the recent sharing revolution to facilitate cooperation within a local community. It's about sharing resources such as tools, produce, gardens, services and more.

The app wroks with the user's location to enable access to resources which are closer and thus more relevant. At first, we will be focusing on gardening: facilitating growing of produce: local, organic fruits and vegetables. After that, hopefully everything else!

Feature roadmap
---------------
- UI
  - Add Bootstrap nav menu + rolls pkg
  - Mobile
    - Fix floating panel, maybe have it non-floating, but collapse and expand?
    - Allow adding a new place by press and hold as ctrl+click is not an option
  - Desktop
    - Esc closes dialog 

- Add features to 'place':
	- resources
      - Sort by category on page (requries data structures re-order?)
      - Sell, rent, donate
  - move place (drag)
	- auto-suggest current location as 'place location'
	- Add 'needs' field (points to entries in both services and resources
  - Friends
    - add 'trusted group'
- Services
	- add dialog to add services similar to category and resources
	- Add 'offered services' field to 'user'
		- options: hire, volunteer


- Support adding a place at specific address (via nominatim). 
	Example here: http://derickrethans.nl/leaflet-and-nominatim.html
