Plentyhood
==========

This web application is all about cooperation within the local community.
It's about sharing resources such as tools, gardens, services etc. 
Creating the next-gen 'Craigslist', on a whole new level, the app wroks with 
the user's location and provides results which are closer and thus more relevant.
At first, the app focuses on gardening: helping people growing food, not lawns.
After that, well, the sky is the limit! =)


Feature roadmap
---------------
- Add features to 'place':
	- Add UI for adding resorce to place
		- options: sell, rent, donation
- Services
	- add dialog to add services

- User features
	- Add 'needs' field to 'user' (points to entries in both services and resources
	- Add 'services' field to 'user'
		- options: hire, volunteer
- UI TBD
	- auto-suggest current location as 'place location'
	- click on place centers map on it, high zoom
	- decrease space between map and header
- Mobile
	- Allow adding a new place somehow as ctrl+click is not an option

- Support adding a place at specific address (via nominatim). 
	Example here: http://derickrethans.nl/leaflet-and-nominatim.html

- Refactor
	- Create globals files
	- rename files (README -> README.md, places.html -> app.html, + more)