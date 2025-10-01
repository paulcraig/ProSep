# JBioFramework Web Application
> The JBioFramework Web Application is a more efficient method of performing 1-Dimensional
> through the use of a browser and file selection in the format of 
> FASTA files. This document will contain information regarding [Download and Installation](#download-and-installation), 
> [Usage for Development](#usage-for-development), and [Testing Usage](#testing-usage) for the application.

## Project Sponsor
- [Dr. Paul Craig](mailto:pac8612@rit.edu)

<img src="frontend/jbio-app/src/assets/profiles/Paul_Craig.jpg" alt="Paul Craig" width="200"/>

Dr. Paul Craig received his B.S. in Chemistry from Oral Roberts University in 1979, and his Ph.D. in Biological Chemistry from The University of Michigan in 1985. Following a post-doc at Henry Ford Hospital (biophysical chemistry of blood clotting; 1985-1988), he spent five years as an analytical biochemistry at BioQuant, Inc., in Ann Arbor, Michigan before joining RIT in 1993.
## Download and Installation:
### Git

```bash
git clone https://github.com/AmrMualla/RITSimulationofProteinSimulations.git
```

Windows:
```bash
cd RITSimulationofProteinSimulations\
```

```bash
py -m pip install -r requirements.txt
```

macOS or Linux:
```bash
cd RITSimulationofProteinSimulations/
```

```bash
pip install -r requirements.txt
```

### Software Requirements
- Python 3.7 or higher
- Node.js 20.11.0 or higher
- React 18.2.0 or higher

## Usage for Development
Navigate to the top level directory by typing in the command line 

Windows:
```bash
cd RITSimulationofProteinSimulations\
```

macOS or Linux:
```bash
cd RITSimulationofProteinSimulations/
```
<br/>

Launch the API server by typing in the command line:
```bash
uvicorn server:app --reload
```

Navigate to the jbio-web-app subdirectory by typing in the command line 

Windows:
```bash
cd frontend\jbio-web-app\
```

macOS or Linux:
```bash
cd frontend/jbio-web-app/
```

<br/>

Launch the application by typing in the command line:
```bash
npm start
```

A browser will open with the URL: http://localhost:3000/

![BrowserImage.png](READMEImages%2FBrowserImage.png)

Press the **`1D Electrophoresis`** button on the left.

Follow the instructions listed beneath the simulation to load the desired FASTA files and begin the simulation:

![1DEInstructions.png](READMEImages%2F1DEInstructions.png)

## Testing Usage

### Frontend Guide:
#### Author: Chase Amador

#### Introduction

This guide will be going over the basics of the Jest tests created in this project, including how to install Jest, create a basic Jest class, and the standards followed creating the existing Jest tests. Jest was a great choice for the team because of the choice to use Node.js and React. Jest synergizes very well with both of these and makes it easy to use.

#### Installation

Installation for Jest is simple with the help of a package manager. Since we are using Node.js with ```npm``` as the package manager, installation is as easy as pasting: 

```bash
npm install --save-dev jest
```

once you navigate to 

Windows:
```bash
..\RITSimulationofProteinSimulations\frontend\jbio-web-app
```

macOS or Linux:

```bash
~/RITSimulationofProteinSimulations/frontend/jbio-web-app
```

<br/>

To do so, open the terminal, which is usually found under the View tab in most IDEs, and select the Terminal button. It will open up the terminal in the default directory. Then navigate to the desired directory by typing

Windows:
```bash
cd frontend\jbio-web-app
```

macOS or Linux:
```bash
cd frontend/jbio-web-app
```

<br/>

This should put you in the correct directory, so typing 

```bash
npm install --save-dev jest
```

in the terminal will install Jest for you and have everything ready to go.

#### Running the Tests
Once the installation is complete, typing 

```bash
npm test
```

will bring up the watch usage buttons which you can use to run the tests. If there is every an error saying:

```bash 
npm test is not recognized
```

 type: 

```bash
npm install
```

again to update the package. Then you should see this:

![FrontendTestingImage1.png](READMEImages%2FFrontendTestingImage1.png)

```a```will run all the test suites.

```f``` will run all the failed tests.

```p``` will let you chose a test suite to test by typing its name.

```t``` will let you chose a specific test to test by typing its name.

```q``` will end the session.

After running a test, it will tell you how many test suites and tests have passed and if they failed, where and why they did. Heres an example output:

![FrontendTestingImage2.png](READMEImages%2FFrontendTestingImage2.png)

#### Jest Test Basics
If on Windows, the Jest tests are stored in

```bash
.\\RITSimulationofProteinSimulations\frontend\jbio-web-app\src\components\__tests__
```

If on macOS or Linux, the Jest tests are stored in

```bash
~/RITSimulationofProteinSimulations/frontend/jbio-web-app/src/components/__tests__
```

<br/>

Currently, there is a test class for each frontend component in the project. They all vary depending on the component but all have a similar format that should be used when creating more tests. For starters, these imports are needed for jest tests:

![FrontendTestingImage3.png](READMEImages%2FFrontendTestingImage3.png)

These are pretty standard imports, the first line doesn’t change, it imports React which is what is used for the web app. The second line is the same format, but you will add in methods you use in your tests. Some examples would be 

```render```, ```fireEvent```, ```screen```, and various others. Adding more methods would look like this:

![FrontendTestingImage4.png](READMEImages%2FFrontendTestingImage4.png)

Now for creating tests, the default test will look like this:

![FrontEndTestingImage5.png](READMEImages%2FFrontEndTestingImage5.png)

You can replace the ```'Test name'``` with whatever you want to name the test. Ensure that it is detailed for ease of viewing which test is being run.

### Backend Guide:
#### Author: Mack Leonard

Navigate to the top level directory by typing in the command line

Windows:
```bash
cd .\RITSimulationofProteinSimulations\
py -m unittest backend.Electro1DTests.ProteinTest
```

macOS or Linux:
```bash
cd ~/RITSimulationofProteinSimulations/
python3 -m unittest backend.Electro1DTests.ProteinTest
```


OR

Some IDEs have a built-in run function for files that can be executed. If you wish to do this, navigate to the ProteinTest.py or any other test file and click the run button.

<br/>

Analyze results from the tests being run and modify the test or method being tested if failed.

### API Guide:

- TODO

## Project Teams

- Fall 2025 to Spring 2026:
  - Coach:
    - [Mark Wilson](mailto:mwvse@rit.edu)
  - Developers:
    - Luke Knofczynski

    - Zachary Van Horn

    - Shreyas Gadwalker

    - Jacob Fey

    - Aditya Vikram

- Fall 2023 to Spring 2024:
  - Coach:
    - [Mark Wilson](mailto:mwvse@rit.edu)
  - Developers:
    - [Chase Amador](https://www.linkedin.com/in/chase-amador-54765b209/)

    - [Beck Anderson](https://www.linkedin.com/in/beck-anderson-se/)

    - [Landon Heatly](https://www.linkedin.com/in/landon-heatly-77a093175/)

    - [Mack Leonard](https://www.linkedin.com/in/mack-leonard/)

    - [Amr Mualla](https://www.linkedin.com/in/amrmualla/)