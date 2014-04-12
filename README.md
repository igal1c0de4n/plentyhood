Plentyhood
==========
Plentyhood is a web application which facilitates sharing, trade and general cooperation within a local community. 
Resources and services can be shared or traded: tools, produce, gardens, related services and anything which comes to mind, really.

The app wroks with the user's location to enable access to resources which are closer and thus more relevant. The posting and search is tag-based.

Feature roadmap
---------------
- Deploy static content on nginx instead of s3
- UI
  - Allow adding a new place by press and hold on touch screens (no ctrl+click)
- Add features:
	- Resources
      - Options: sell, rent, donate
      - Quantity
      - Calendar for resource (advanced)
  - Location
    - Support adding a place at specific address (via nominatim). 
      Example here: http://derickrethans.nl/leaflet-and-nominatim.html
  - Place
    - Add 'needs' concept (implement with tags engine)
  - Groups
    - Add 'friends group' to user
  - tags
    - allow search for existing tags, only
    - spell check tags on resource creation 
- Services
	- Add services offered by user, store under place (hire, volunteer)
- Admin
  - Forms for removing tags, places and users
- Deploy
  - Docker
  - nginx

License
-------
Appropriate license is TBD. Meanwhile, please consider this codebase private. As such, except for the purpose of evaluation, there is no permission to make public, commecrial or private use of this code base. Please contact if you would like to cooperate on this project.
