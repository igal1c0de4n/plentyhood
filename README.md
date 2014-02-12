Plentyhood
==========
Plentyhood is a web application which facilitates sharing and cooperation within a local community. It's about sharing resources such as tools, produce, gardens, services and more.

The app wroks with the user's location to enable access to resources which are closer and thus more relevant. Search for resources is tag-based

Feature roadmap
---------------
- Fix broken search
  - Resource to have geo-location
  - Fix search to look in Resources, not in Places
- Add 'search results' list
  - Marked element in search results centers map on location and opens marker popup 
- Explore putting both place panel and search panel on same div as navbar, 
  set z-index of container to -1 so map overlays it
- Deploy static content on nginx instead of s3
- UI
  - Mobile ui
      - Allow adding a new place by press and hold on touch screens 
        (no ctrl+click)

- Add features:
	- Resources
      - Options: sell, rent, donate
      - Quantity
      - Calendar per resource (?)
  - Location
    - Support adding a place at specific address (via nominatim). 
      Example here: http://derickrethans.nl/leaflet-and-nominatim.html
  - Place
    - Add 'needs' concept (implement with tags engine)
  - Groups
    - Add 'friends group' to user
- Services
	- Add services offered by user, store under place as array of {user, service}
		- Service details: hire, volunteer
- Admin
  - Forms for removing tags, places and users

License
-------
Appropriate license is TBD. Meanwhile, please consider this codebase private. As such, except for the purpose of evaluation, there is no permission to make public, commecrial or private use of this code base. Please contact if you would like to cooperate on this project.
