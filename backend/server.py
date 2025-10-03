import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import api.one_de_routes as one_de_routes
import api.two_de_routes as two_de_routes



'''
HOW TO START UP API SERVER:
   
1. Run the command: uvicorn server:app --reload
        (If that command doesn't work, try: python -m uvicorn server:app --reload)
   This activates the FastAPI system. The terminal window will
   have to stay open for as long as you have the server running.
   
   (or if this is for debugging, you can start it up using the start up call at the bottom.
   it is recommended you use the command line start however.)
   
2. Open up http://127.0.0.1:8000/ in your browser.
   You should see the message:
   { 'message': 'Ready to go' }
   This means the API server is up and running!
   
3. To close the API server, either close the terminal window
   that you started or do the command CTRL^C (Windows or Linux)
   or Command-C (MacOS).
   
VIEWING API DOCUMENTATION:
1. If API is running on a server with a domain name (ex: https://www.projectwebsite.com/api),
   navigate to the url that would be the base for the api calls, followed by /docs.
   (ex: https://www.projectwebsite.com/api/docs)
   
2. If on local system: go to http://127.0.0.1:8000/docs
   
Good luck developing!
-Beck Anderson
'''

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Routers
app.include_router(one_de_routes.router)
app.include_router(two_de_routes.router)

''' 
NOTE FOR FUTURE DEVELOPERS:
In order to add additional files for the API, such as the addition of 2DE,
simply do the following:
1. Make the file (look at Electro1D.simulation.py in the API Requests folder for reference)
2. import the file (ex: import backend.API.APIRequests.startup as startup)
3. above this comment, add: app.include_router(FILE_VARIABLE_HERE.router)

It should now be all good to go!
'''

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000)
