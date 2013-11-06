Plentyhood
==========

This web application is about cooperation within the local community.
It's about sharing resources such as tools, gardens, services etc. 
Creating the next-gen 'Craigslist', on a whole new level, the app wroks with 
the user's location and provides results which are closer and thus more relevant.
At first, the app focuses on gardening: helping people growing food, not lawns.
After that, well, the sky is the limit! =)


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
