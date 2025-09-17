import React from 'react';
import './About.css';

import Profile from '../components/Profile';
import * as profiles from '../assets/profiles';


type Person = {
  photo: string;
  name: string;
  title: string;
  about?: string;
  email?: string;
  phone?: string;
  location?: string;
  scale?: number;
};


const sponsor: Person = {
  photo: profiles.paul_c,
  name: 'Dr. Paul Craig',
  title: 'Professor of Biochemistry, RIT',
  about:
    'Dr. Paul Craig earned his B.S. in Chemistry from Oral Roberts University in 1979 ' +
    'and his Ph.D. in Biological Chemistry from the University of Michigan in 1985. ' +
    'After a post-doc at Henry Ford Hospital, studying blood clotting, he worked five years ' +
    'as an analytical biochemist at BioQuant in Ann Arbor before joining RIT in 1993.\n\n' +
    'Today, he teaches advanced under/graduate student-directed research in biology, ' +
    'chemistry, and biochemistry, and sponsors JBioFramework, offering domain expertise and project guidance.',

  email: 'pac8612@rit.edu',
  phone: '(585) 475-6145',
  location: 'Rochester, NY',
};


const coach: Person = {
  photo: profiles.mark_z,
  name: 'Mark Wilson',
  title: 'Team Coach',
  about: '🎬 Technical Guidance',
  email: 'mwilson1962@gmail.com',
  phone: 'None',
  location: 'Rochester, NY',
};


const currentDevs: Person[] = [
  coach,
  { photo: profiles.zach_vh,    name: 'Zachary Van Horn',   title: 'Project Leader',            email: 'zjv4576@rit.edu',   phone: 'None',  location: 'Rochester, NY' },
  { photo: profiles.shreyes_g,  name: 'Shreyes Gadwalkar',  title: 'Head of Communications',    email: 'ssg9922@rit.edu',   phone: 'None',  location: 'Rochester, NY' },
  { photo: profiles.mark_z,     name: 'Luke Knofczynski',   title: 'Technical Lead',            email: 'ldk7811@rit.edu',   phone: 'None',  location: 'Rochester, NY' },
  { photo: profiles.mark_z,     name: 'Aditya Vikram',      title: 'Scrum Master',              email: 'av9242@rit.edu',    phone: 'None',  location: 'Rochester, NY' },
  { photo: profiles.mark_z,     name: 'Jacob Fay',          title: 'Testing Lead',              email: 'jpf5643@rit.edu',   phone: 'None',  location: 'Rochester, NY' },
];


const historicDevs: Person[] = [
  { photo: profiles.landon_h,   name: 'Landon Heatly',  title: 'Project Leader',            email: 'lbh1442@rit.edu',   phone: '(203) 832-9841',    location: 'Rochester, NY' },
  { photo: profiles.amr_m,      name: 'Amr Mualla',     title: 'Technical Lead',            email: 'am3576@rit.edu',    phone: '(347) 631-7359',    location: 'Rochester, NY' },
  { photo: profiles.beck_a,     name: 'Beck Anderson',  title: 'Head of Communications',    email: 'bea1935@rit.edu',   phone: '(716) 640-2894',    location: 'Rochester, NY' },
  { photo: profiles.mack_l,     name: 'Mack Leonard',   title: 'Scrum Master',              email: 'mml2034@rit.edu',   phone: '(203) 731-9620',    location: 'Rochester, NY' },
  { photo: profiles.chase_a,    name: 'Chase Amador',   title: 'Testing Lead',              email: 'cma6320@rit.edu',   phone: '(203) 725-4442',    location: 'Rochester, NY' },
];


const About: React.FC = () => {
  return (
    <div className='about-page'>
      {/* Sponsor + Project */}
      <div className='about-intro'>
        <aside className='about-sponsor'>
            <div className='sponsor-block'>
                <h2 className='section-header'>Project Sponsor</h2>
                <Profile {...sponsor} size='large' />
            </div>
        </aside>
        <section className='about-text'>
          <h2 className='section-header'>Project Purpose</h2>
          <p>
            JBioFramework (JBF) is an open-source suite of analytical simulations
            of protein structure and function. It provides students with access
            to tools like 1D electrophoresis, 2D electrophoresis, Tandem Mass
            Spectrometry, chemical drawing, and an upcoming simulation of
            peptide separation by Reversed Phase Liquid Chromatography (RPLC).
          </p>
          <br></br>
          <p>
            Originally built in Java in 1997, JBF has since been converted into
            a modern web application with a JavaScript front-end and Python
            back-end. It is used in biochemistry, bioinformatics, and chemistry
            education at RIT and beyond.
          </p>
          <br></br>
          <h2 className='section-header'>Commercial Use</h2>
          <p>
              Use by individual <strong>students and teachers</strong> is <strong>free of charge</strong>. 
              Educational presentations with <strong>fewer than 50 attendees</strong> are also free, 
              while those with <strong>50 to 200 attendees</strong> require a <strong>$100 license fee</strong>. 
              Presentations with <strong>more than 200 attendees</strong> require a <strong>$500 license fee</strong>. 
              <strong> Online publication</strong> requires a <strong>negotiated commercial license</strong>. 
              <strong> Unauthorized use or distribution</strong> constitutes <strong>piracy</strong> and may result in legal action.
          </p>
          <br></br>
          <p>
            For any inquiries, please contact Dr. Paul Craig at <a href='mailto:pac8612@rit.edu'>pac8612@rit.edu</a>.
          </p>

        </section>
      </div>
      <section className='dev-team'>
        <h2 className='section-header'>Development Team</h2>
        <div className='dev-grid'>
          {currentDevs.map((dev) => (
            <Profile key={dev.name} size='small' about='⚡Active Developer' {...dev} />
          ))}
          {historicDevs.map((dev) => (
            <Profile key={dev.name} size='small' about='↩️ Previous Contributor' {...dev} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default About;
